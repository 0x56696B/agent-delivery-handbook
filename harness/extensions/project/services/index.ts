import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildEnv,
	buildSpec,
	expandServices,
	feScheme,
	healthUrl,
	type Mode,
	PHASES,
	pickPort,
	SERVICE_IDS,
	SERVICES,
	type ServiceId,
	serviceUrl,
	type SiblingPort,
	type WiringEntry,
	WIRES_TO,
} from "./plan";

// Process host: own detached supervisor. The omp launch broker is not
// importable from a project extension in the compiled omp binary
// ("Cannot find package '@oh-my-pi/pi-coding-agent'", omp 18.10.4), so each
// service runs in its own process group, logs to a file, and stops by
// group signal. Services are not visible in proc:// or `omp ps`.

interface Entry {
	name: string;
	service: ServiceId;
	mode: Mode;
	port: number;
	debugPort: number | null;
	/** Repo path as given (symlink kept). */
	repo: string;
	pid: number;
	pgid: number;
	logFile: string;
	/** Log byte offset where this run's output starts. */
	logOffset: number;
	ownerSessionId: string;
	startedAt: number;
	agentEnv: Record<string, string>;
}

type Ledger = Map<string, Entry>;
type GuardLedger = Map<string, { cwd: string; startedAt: number }>;
const g = globalThis as unknown as Record<symbol, unknown>;
const ledger = (g[Symbol.for("agent.services.ledger")] ??= new Map()) as Ledger;
const guardLedger = (g[Symbol.for("agent.processOwnershipGuard.ledger")] ??= new Map()) as GuardLedger;

type ErrorCode =
	| "repo_missing"
	| "needs_env"
	| "setup_failed"
	| "docker_unavailable"
	| "port_in_use"
	| "no_free_port"
	| "debug_unsupported"
	| "start_failed"
	| "health_failed"
	| "dependency_failed"
	| "not_owned"
	| "ambiguous_service";

interface Owner {
	pid: number;
	cwd: string | null;
	command: string | null;
	etime: string | null;
}

interface ServiceError {
	code: ErrorCode;
	message: string;
	owner?: Owner;
}

type Report = Record<string, unknown> & { service: ServiceId; error: ServiceError | null };

interface ExecOut {
	stdout: string;
	stderr: string;
	code: number;
}

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const quote = (token: string) => `'${token.replaceAll("'", `'\\''`)}'`;

function runSync(file: string, args: string[]): string {
	try {
		return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
	} catch (error) {
		// lsof exits 1 when nothing matches; its stdout is still the answer.
		return error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string" ? error.stdout : "";
	}
}

/** PIDs listening on a TCP port. Reads the kernel socket table; never connects. */
function listeners(port: number): number[] {
	return runSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])
		.split("\n")
		.map(line => Number.parseInt(line, 10))
		.filter(pid => Number.isInteger(pid) && pid > 0);
}

function pidCwd(pid: number): string | null {
	const line = runSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
		.split("\n")
		.find(l => l.startsWith("n"));
	return line ? line.slice(1) : null;
}

function psInfo(pid: number): { etime: string | null; command: string | null } {
	const out = runSync("ps", ["-p", String(pid), "-o", "etime=,command="]).trim();
	if (!out) return { etime: null, command: null };
	const space = out.indexOf(" ");
	return space < 0 ? { etime: out, command: null } : { etime: out.slice(0, space), command: out.slice(space + 1).trim() };
}

function ownerInfo(pid: number): Owner {
	return { pid, cwd: pidCwd(pid), ...psInfo(pid) };
}

function real(p: string): string {
	try {
		return fs.realpathSync(p);
	} catch {
		return path.resolve(p);
	}
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error instanceof Error && "code" in error && error.code === "EPERM";
	}
}

function signalGroup(pgid: number, signal: NodeJS.Signals): void {
	try {
		process.kill(-pgid, signal);
	} catch {
		// group already gone
	}
}

function readLog(entry: Entry, fromOffset: boolean): string {
	try {
		const buf = fs.readFileSync(entry.logFile);
		return buf.subarray(fromOffset ? Math.min(entry.logOffset, buf.length) : 0).toString("utf8");
	} catch {
		return "";
	}
}

function lastLines(text: string, n: number, grep?: RegExp): string {
	const lines = text.split("\n");
	if (lines.at(-1) === "") lines.pop();
	const kept = grep ? lines.filter(line => grep.test(line)) : lines;
	return kept.slice(-n).join("\n");
}

function sessionIdOf(ctx: ExtensionContext): string {
	return ctx.sessionManager.getSessionId?.() || `services:${process.pid}`;
}

function liveEntries(service: ServiceId, owner: string): Entry[] {
	return [...ledger.values()].filter(e => e.service === service && e.ownerSessionId === owner && alive(e.pid));
}

function forget(entry: Entry): void {
	ledger.delete(entry.name);
	guardLedger.delete(entry.name);
}

export default function servicesExtension(pi: ExtensionAPI): void {
	const z = pi.zod;
	const Svc = z.enum(SERVICE_IDS);
	const ownPgid = Number.parseInt(runSync("ps", ["-o", "pgid=", "-p", String(process.pid)]).trim(), 10);

	async function exec(file: string, args: string[], cwd: string, timeout?: number): Promise<ExecOut> {
		try {
			const r = await pi.exec(file, args, { cwd, timeout });
			return { stdout: r.stdout, stderr: r.stderr, code: r.code };
		} catch (error) {
			const enoent = (error instanceof Error && "code" in error && error.code === "ENOENT") || /ENOENT|not found/i.test(String(error));
			return { stdout: "", stderr: String(error), code: enoent ? 127 : 1 };
		}
	}

	async function curl(url: string): Promise<{ status: number; body: string }> {
		const r = await exec("curl", ["-sk", "--max-time", "5", "-o", "-", "-w", "\n%{http_code}", url], os.homedir());
		const cut = r.stdout.lastIndexOf("\n");
		return { status: Number.parseInt(r.stdout.slice(cut + 1), 10) || 0, body: r.stdout.slice(0, Math.max(cut, 0)) };
	}

	/**
	 * Ownership of each entry's process group, in one `ps` and one `lsof` call.
	 * A dead service's pgid can be reused by another process, so a group counts
	 * as ours only while one member still runs in the entry's repo.
	 */
	function groupOwnership(entries: Entry[]): Map<string, "ours" | "foreign" | "gone"> {
		const membersByPgid = new Map<number, number[]>();
		for (const line of runSync("ps", ["-axo", "pid=,pgid="]).split("\n")) {
			const [pid, pgid] = line.trim().split(/\s+/).map(Number);
			if (!(pid > 0) || !entries.some(e => e.pgid === pgid)) continue;
			const list = membersByPgid.get(pgid) ?? [];
			list.push(pid);
			membersByPgid.set(pgid, list);
		}
		const allPids = [...membersByPgid.values()].flat();
		const cwdByPid = new Map<number, string>();
		if (allPids.length > 0) {
			let current = 0;
			for (const line of runSync("lsof", ["-a", "-d", "cwd", "-Fn", "-p", allPids.join(",")]).split("\n")) {
				if (line.startsWith("p")) current = Number.parseInt(line.slice(1), 10);
				else if (line.startsWith("n") && current > 0) cwdByPid.set(current, real(line.slice(1)));
			}
		}
		const result = new Map<string, "ours" | "foreign" | "gone">();
		for (const e of entries) {
			const members = membersByPgid.get(e.pgid) ?? [];
			const repoReal = real(e.repo);
			result.set(
				e.name,
				members.length === 0 ? "gone" : members.some(pid => cwdByPid.get(pid) === repoReal) ? "ours" : "foreign",
			);
		}
		return result;
	}

	/** Stop one entry's process group, then any orphaned debugpy adapter on its debug port. */
	async function stopEntry(
		entry: Entry,
		budgetMs: number,
		ownership: "ours" | "foreign" | "gone",
	): Promise<{ warnings: string[] }> {
		const warnings: string[] = [];
		if (ownership === "ours") {
			signalGroup(entry.pgid, "SIGTERM");
			const deadline = Date.now() + budgetMs;
			while (Date.now() < deadline && alive(-entry.pgid)) await sleep(100);
			if (alive(-entry.pgid)) signalGroup(entry.pgid, "SIGKILL");
		} else if (ownership === "foreign") {
			warnings.push(`process group ${entry.pgid} no longer runs in ${real(entry.repo)}; not signalled`);
		}
		if (entry.debugPort !== null) {
			for (const pid of listeners(entry.debugPort)) {
				const out = runSync("ps", ["-p", String(pid), "-o", "ppid=,command="]).trim();
				const [ppid, ...rest] = out.split(/\s+/);
				const command = rest.join(" ");
				const isHelper =
					ppid === "1" &&
					command.includes("debugpy/adapter") &&
					command.includes("--for-server") &&
					command.includes(`--port ${entry.debugPort}`);
				if (isHelper) {
					try {
						process.kill(pid, "SIGTERM");
					} catch {
						// already gone
					}
				} else {
					warnings.push(`debug port ${entry.debugPort} still held by pid ${pid}: ${command}`);
				}
			}
			if (listeners(entry.debugPort).length > 0) await sleep(500);
		}
		forget(entry);
		return { warnings };
	}

	interface StartRequest {
		service: ServiceId;
		mode: Mode;
		repo: string;
		explicitPort?: number;
		explicitDebugPort?: number;
		agentEnv: Record<string, string>;
	}

	async function startOne(
		req: StartRequest,
		ctx: ExtensionContext,
		owner: string,
		taken: Set<number>,
		siblings: Partial<Record<ServiceId, SiblingPort>>,
	): Promise<Report> {
		const def = SERVICES[req.service];
		const report: Report = {
			service: req.service,
			name: null,
			mode: req.mode,
			state: "failed",
			pid: null,
			cwd: null,
			etime: null,
			port: null,
			debug_port: null,
			auto_picked_port: false,
			url: null,
			health: null,
			wiring: [] as WiringEntry[],
			overridden: [] as string[],
			warnings: [] as string[],
			log_file: null,
			error: null,
		};
		const warnings = report.warnings as string[];
		const fail = (code: ErrorCode, message: string, extra?: Partial<ServiceError>): Report => {
			report.error = { code, message, ...extra };
			return report;
		};

		if (req.mode === "debug" && def.debugPort === undefined) {
			return fail("debug_unsupported", `${req.service} has no debug mode; use browser DevTools on the running page`);
		}

		try {
			if (!fs.statSync(req.repo).isDirectory()) throw new Error("not a directory");
		} catch {
			return fail("repo_missing", `repo not found: ${req.repo}`);
		}
		const envPath = path.join(req.repo, ".env");
		if (!fs.existsSync(envPath)) return fail("needs_env", `missing ${envPath}; the tool never creates or edits .env`);

		const running = liveEntries(req.service, owner).filter(
			e => req.explicitPort === undefined || e.port === req.explicitPort,
		);
		if (running.length > 0) {
			const e = running[0];
			const info = psInfo(e.pid);
			if (e.mode !== req.mode) warnings.push(`already running in ${e.mode} mode; use action restart to change mode`);
			const scheme = feScheme(e.agentEnv, process.env);
			Object.assign(report, {
				name: e.name,
				mode: e.mode,
				state: "already_running",
				pid: e.pid,
				cwd: pidCwd(e.pid),
				etime: info.etime,
				port: e.port,
				debug_port: e.debugPort,
				url: serviceUrl(e.service, e.port, scheme),
				log_file: e.logFile,
			});
			return report;
		}

		// Port picks are synchronous so parallel starts in one phase never pick the same port.
		const strict = req.service === "web-app";
		const isBusy = (p: number) => listeners(p).length > 0;
		const portPick = pickPort(def.port, req.explicitPort, strict, isBusy, taken);
		if ("error" in portPick) {
			const holder = listeners(portPick.port)[0];
			return fail(
				portPick.error,
				portPick.error === "port_in_use"
					? `port ${portPick.port} is in use by another process; it is never stopped. Pass another port.`
					: `no free port in ${def.port + 1}..${def.port + 99}`,
				holder ? { owner: ownerInfo(holder) } : undefined,
			);
		}
		taken.add(portPick.port);
		const port = portPick.port;
		report.port = port;
		report.auto_picked_port = portPick.autoPicked;

		let debugPort: number | null = null;
		if (req.mode === "debug") {
			const dbg = pickPort(def.debugPort as number, req.explicitDebugPort, false, isBusy, taken);
			if ("error" in dbg) {
				const holder = listeners(dbg.port)[0];
				return fail(
					dbg.error,
					dbg.error === "port_in_use" ? `debug port ${dbg.port} is in use by another process` : "no free debug port",
					holder ? { owner: ownerInfo(holder) } : undefined,
				);
			}
			taken.add(dbg.port);
			debugPort = dbg.port;
			report.debug_port = debugPort;
		}

		// Dependency setup.
		if (def.python) {
			let sync = await exec("uv", ["sync"], req.repo, 300_000);
			if (sync.code !== 0) sync = await exec("uv", ["sync"], req.repo, 300_000);
			if (sync.code !== 0) return fail("setup_failed", `uv sync failed twice:\n${lastLines(sync.stderr, 40)}`);
		} else {
			let install = await exec("pnpm", ["install", "--frozen-lockfile"], req.repo, 600_000);
			if (install.code === 127) {
				await exec("corepack", ["enable"], req.repo, 60_000);
				install = await exec("pnpm", ["install", "--frozen-lockfile"], req.repo, 600_000);
			}
			if (install.code !== 0) {
				return fail("setup_failed", `pnpm install --frozen-lockfile failed:\n${lastLines(install.stderr || install.stdout, 40)}`);
			}
		}
		if (req.service === "orchestrator") {
			const args = ["compose", "-p", "orchestrator-local-mongo", "-f", "docker-compose.local.yaml", "up", "-d", "--wait", "mongodb"];
			const mongo = await exec("docker", args, req.repo, 120_000);
			if (mongo.code !== 0) {
				const text = `${mongo.stderr}\n${mongo.stdout}`;
				if (/Cannot connect to the Docker daemon|colima|docker\.sock/i.test(text) || mongo.code === 127) {
					return fail(
						"docker_unavailable",
						`docker is not reachable; start Colima yourself; the tool never restarts it.\n${lastLines(text, 40)}`,
					);
				}
				return fail("setup_failed", `local Mongo compose failed:\n${lastLines(text, 40)}`);
			}
		}

		// Env and process spec.
		const plan = buildEnv(req.service, port, { siblings, agentEnv: req.agentEnv, inheritedEnv: process.env });
		report.wiring = plan.wiring;
		report.overridden = plan.overridden;
		warnings.push(...plan.warnings);
		const spec = buildSpec(req.service, req.mode, port, debugPort);
		const scheme = feScheme(req.agentEnv, process.env);
		const name = `${req.service}-${port}`;
		report.name = name;

		const logDir = path.join(os.tmpdir(), "services", owner);
		fs.mkdirSync(logDir, { recursive: true });
		const logFile = path.join(logDir, `${name}.log`);
		report.log_file = logFile;
		let logOffset = 0;
		try {
			logOffset = fs.statSync(logFile).size;
		} catch {
			// new log
		}
		const envTokens = Object.entries(plan.env).map(([k, v]) => quote(`${k}=${v}`));
		const script =
			`cd ${quote(req.repo)} || exit 97\n` +
			"set -m\n" +
			`nohup env ${envTokens.join(" ")} ${[spec.application, ...spec.args].map(quote).join(" ")} ` +
			`</dev/null >>${quote(logFile)} 2>&1 &\n` +
			"echo $!\n";
		const spawned = await exec("/bin/sh", ["-c", script], req.repo, 15_000);
		const pid = Number.parseInt(spawned.stdout.trim(), 10);
		if (spawned.code !== 0 || !Number.isInteger(pid) || pid <= 1) {
			return fail("start_failed", `spawn failed (exit ${spawned.code}): ${spawned.stderr.trim()}`);
		}
		const pgid = Number.parseInt(runSync("ps", ["-o", "pgid=", "-p", String(pid)]).trim(), 10);
		const entry: Entry = {
			name,
			service: req.service,
			mode: req.mode,
			port,
			debugPort,
			repo: req.repo,
			pid,
			pgid: pgid === pid ? pgid : pid,
			logFile,
			logOffset,
			ownerSessionId: owner,
			startedAt: Date.now(),
			agentEnv: req.agentEnv,
		};
		if (pgid !== pid || pgid === ownPgid) {
			// Never group-signal a group this tool did not create.
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// gone
			}
			return fail("start_failed", `process ${pid} did not get its own process group (pgid ${pgid}); killed it`);
		}
		ledger.set(name, entry);
		guardLedger.set(name, { cwd: real(req.repo), startedAt: entry.startedAt });
		report.pid = pid;

		const failStarted = async (code: ErrorCode, message: string, stop: boolean): Promise<Report> => {
			const tail = lastLines(readLog(entry, true), 40);
			if (stop) await stopEntry(entry, 5000, groupOwnership([entry]).get(entry.name) ?? "gone");
			return fail(code, `${message}${stop ? " (process stopped)" : " (process left running for inspection)"}\n--- last 40 log lines ---\n${tail}`);
		};

		// Readiness.
		if (spec.ready) {
			const pattern = new RegExp(spec.ready.log);
			const deadline = Date.now() + spec.ready.timeoutMs;
			let matched = false;
			while (Date.now() < deadline) {
				if (pattern.test(readLog(entry, true))) {
					matched = true;
					break;
				}
				if (!alive(-pgid)) break;
				await sleep(250);
			}
			if (!matched) {
				return failStarted("start_failed", alive(-pgid) ? "ready log line not seen within 60 s" : "process exited before ready", true);
			}
		} else if (debugPort !== null) {
			const deadline = Date.now() + 30_000;
			let listening = false;
			while (Date.now() < deadline) {
				if (listeners(debugPort).length > 0) {
					listening = true;
					break;
				}
				if (!alive(-pgid)) break;
				await sleep(500);
			}
			if (!listening) return failStarted("start_failed", `debugpy not listening on ${debugPort} within 30 s`, true);
		}

		// PID identity.
		const cwd = pidCwd(pid);
		const info = psInfo(pid);
		report.cwd = cwd;
		report.etime = info.etime;
		if (cwd === null || real(cwd) !== real(req.repo)) {
			warnings.push(`pid ${pid} cwd ${cwd ?? "unknown"} does not match repo ${real(req.repo)}`);
		}
		report.url = serviceUrl(req.service, port, scheme);

		if (req.mode === "debug") {
			report.state = "waiting_for_debugger";
			report.attach = `localhost:${debugPort}`;
		} else {
			const url = healthUrl(req.service, port, scheme);
			let health = { status: 0, body: "" };
			const deadline = Date.now() + 20_000;
			while (Date.now() < deadline) {
				health = await curl(url);
				if (health.status === 200) break;
				await sleep(1000);
			}
			report.health = health;
			if (health.status !== 200) {
				report.state = "running";
				return failStarted("health_failed", `GET ${url} returned ${health.status || "no response"}`, false);
			}
			report.state = "ready";
		}
		if (req.service === "orchestrator") {
			// Proof the wiring landed: the settings-repr tokens the app prints, and the MCP requests it made.
			const log = readLog(entry, true);
			const tokens = log.match(/mcp_(image_generation|data)_url=\S+/g) ?? [];
			const posts = [...log.matchAll(/POST (http:\/\/localhost:\d+\/mcp) "HTTP\/[\d.]+ (\d+[^"]*)"/g)].map(
				m => `POST ${m[1]} -> ${m[2]}`,
			);
			const errors = (log.match(/^.*Failed to load MCP tools.*$/gm) ?? []).map(line => line.slice(0, 300));
			report.wiring_log = [...new Set([...tokens, ...posts, ...errors])];
		}
		return report;
	}

	async function startAll(reqs: StartRequest[], ctx: ExtensionContext, owner: string): Promise<Report[]> {
		const reports: Report[] = [];
		const taken = new Set<number>();
		const siblings: Partial<Record<ServiceId, SiblingPort>> = {};
		for (const id of SERVICE_IDS) {
			const e = liveEntries(id, owner)[0];
			if (e) siblings[id] = { port: e.port, source: "running" };
		}
		const failed = new Set<ServiceId>();
		for (const phase of PHASES) {
			const inPhase = reqs.filter(r => phase.includes(r.service));
			const results = await Promise.all(
				inPhase.map(req => {
					const broken = WIRES_TO[req.service].filter(dep => failed.has(dep));
					if (broken.length > 0) {
						return Promise.resolve<Report>({
							service: req.service,
							state: "skipped",
							error: { code: "dependency_failed", message: `skipped: ${broken.join(", ")} failed in this call` },
						});
					}
					return startOne(req, ctx, owner, taken, siblings);
				}),
			);
			for (const r of results) {
				const port = r.port;
				const ok = r.error === null || r.error.code === "health_failed";
				if (!ok) failed.add(r.service);
				if (r.error === null && typeof port === "number") siblings[r.service] = { port, source: "this_call" };
				reports.push(r);
			}
		}
		return reports;
	}

	async function stopTargets(entries: Entry[]): Promise<Report[]> {
		const reports: Report[] = [];
		for (const phase of [...PHASES].reverse()) {
			const inPhase = entries.filter(e => phase.includes(e.service));
			const ownership = groupOwnership(inPhase);
			reports.push(
				...(await Promise.all(
					inPhase.map(async e => {
						const { warnings } = await stopEntry(e, 5000, ownership.get(e.name) ?? "gone");
						const portHolders = listeners(e.port);
						const report: Report = {
							service: e.service,
							name: e.name,
							mode: e.mode,
							state: "stopped",
							port: e.port,
							port_free: portHolders.length === 0,
							port_listeners: portHolders,
							debug_port: e.debugPort,
							warnings,
							error: null,
						};
						if (e.debugPort !== null) {
							const dbgHolders = listeners(e.debugPort);
							report.debug_port_free = dbgHolders.length === 0;
							report.debug_port_listeners = dbgHolders;
						}
						return report;
					}),
				)),
			);
		}
		return reports;
	}

	pi.on("session_shutdown", async (_event, ctx) => {
		const owner = sessionIdOf(ctx);
		const mine = [...ledger.values()].filter(e => e.ownerSessionId === owner);
		// The shutdown handler gets 2 s: one batched ownership check, then parallel stops.
		const ownership = groupOwnership(mine);
		await Promise.all(mine.map(e => stopEntry(e, 1200, ownership.get(e.name) ?? "gone")));
	});

	pi.registerTool({
		name: "services",
		label: "Services",
		loadMode: "essential",
		description: [
			"Start, stop, restart, inspect, and read logs of the 5 local services: file-gateway, media-mcp, data-mcp, orchestrator, web-app. Edit the service table in plan.ts to match your own repos.",
			"- start: takes a service list or \"all\". Starts in dependency order (file-gateway, media-mcp, data-mcp in parallel; then orchestrator; then web-app). Runs uv sync / pnpm install --frozen-lockfile on every start; orchestrator also runs the local Mongo compose (never restarts Colima). Checks .env exists but never reads or writes it. Verifies PID cwd and GET /health (200). Debug mode (`debug` list) runs debugpy --wait-for-client and returns state waiting_for_debugger with `attach`; no health check. web-app has no debug mode.",
			"- Port policy: canonical port first; if another process holds it, the tool picks the next free port and rewires siblings. An explicit port in `ports`/`debug_ports` is strict (port_in_use if busy). web-app is always strict (5173 unless you pass a port). The tool never stops a process it did not start.",
			"- Wiring: orchestrator gets AGENT_MCP_IMAGE_GENERATION_URL / AGENT_MCP_DATA_URL; web-app gets VITE_ORCHESTRATOR_BASE_URL / VITE_FILES_BASE_URL (plus OIDC redirect vars off 5173). Sibling port source: started in this call, then running under this session, then canonical (with a warning).",
			"- env: per-service map for this invocation only. Precedence: inherited process env < tool wiring < your `env`.",
			"- stop: stops the listed services, or every service this session started. Reports port_free (and debug_port_free). restart: stop then start with the same mode, ports, and env unless the call overrides them.",
			"- status: services this OMP process started, with state, owned, PID cwd/etime, health. logs: exactly one service; `lines` (default 40) and `grep` regex.",
			"Call from the main agent; services started by a subagent stop when that subagent ends. Services also stop when the omp session ends. Read logs with action logs or `read` the returned log_file. Not visible in proc:// or omp ps.",
		].join("\n"),
		parameters: z.object({
			action: z.enum(["start", "stop", "restart", "status", "logs"]),
			services: z
				.union([z.literal("all"), z.array(Svc)])
				.optional()
				.describe("start/restart: required. stop: default every service this session started. status: default all. logs: exactly one."),
			task_dir: z.string().optional().describe("Task folder holding the repo links. Default: session cwd. Relative to session cwd."),
			repo_paths: z
				.record(Svc, z.string())
				.optional()
				.describe("Per-service worktree path; overrides <task_dir>/<repo dir>. Relative to session cwd."),
			debug: z.array(Svc).optional().describe("Services to run in debug mode; others run normal."),
			ports: z.record(Svc, z.number().int()).optional().describe("Explicit (strict) HTTP ports."),
			debug_ports: z.record(Svc, z.number().int()).optional().describe("Explicit (strict) debugpy ports."),
			env: z
				.record(Svc, z.record(z.string(), z.string()))
				.optional()
				.describe("Per-service extra env, highest precedence. Example: {\"web-app\": {\"VITE_DEV_HTTPS\": \"false\"}}"),
			lines: z.number().int().optional().describe("logs: line count, default 40."),
			grep: z.string().optional().describe("logs: filter regex."),
		}),
		approval: (args: unknown) => {
			const action = args && typeof args === "object" && "action" in args ? args.action : undefined;
			return action === "status" || action === "logs" ? "read" : "exec";
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const owner = sessionIdOf(ctx);
			const taskDir = path.resolve(ctx.cwd, params.task_dir ?? ".");
			const list = params.services === undefined ? undefined : expandServices(params.services as "all" | ServiceId[]);
			for (const [svc, vars] of Object.entries(params.env ?? {})) {
				for (const key of Object.keys(vars)) {
					if (!ENV_KEY.test(key)) throw new Error(`env.${svc}: invalid variable name ${JSON.stringify(key)}`);
				}
			}
			const debugSet = params.debug ? new Set(params.debug as ServiceId[]) : undefined;
			// Repos are reached only through a task-folder symlink (setup-task-branch.sh).
			// A *-bare path, or a real directory that is not such a link, is refused.
			const repoOf = (id: ServiceId) => {
				const p = params.repo_paths?.[id] ? path.resolve(ctx.cwd, params.repo_paths[id] as string) : path.join(taskDir, SERVICES[id].repoDir);
				if (p.split(path.sep).some(seg => seg.endsWith("-bare"))) {
					throw new Error(`${id}: ${p} is inside a *-bare repo. Use a task folder that holds the symlinked repos (task_dir or repo_paths).`);
				}
				let isLink = false;
				try {
					isLink = fs.lstatSync(p).isSymbolicLink();
				} catch {
					// missing path: reported by the start phase
					return p;
				}
				if (!isLink) {
					throw new Error(`${id}: ${p} is not a symlink in a task folder. Run setup-task-branch.sh and point task_dir at that folder.`);
				}
				return p;
			};
			const ports = params.ports as Partial<Record<ServiceId, number>> | undefined;
			const debugPorts = params.debug_ports as Partial<Record<ServiceId, number>> | undefined;
			const envOf = params.env as Partial<Record<ServiceId, Record<string, string>>> | undefined;

			let services: Report[];
			switch (params.action) {
				case "start": {
					if (!list) throw new Error("action start needs `services`");
					const reqs = list.map<StartRequest>(id => ({
						service: id,
						mode: debugSet?.has(id) ? "debug" : "normal",
						repo: repoOf(id),
						explicitPort: ports?.[id],
						explicitDebugPort: debugPorts?.[id],
						agentEnv: envOf?.[id] ?? {},
					}));
					services = await startAll(reqs, ctx, owner);
					break;
				}
				case "restart": {
					if (!list) throw new Error("action restart needs `services`");
					const pre: Report[] = [];
					const stops: Entry[] = [];
					const reqs: StartRequest[] = [];
					for (const id of list) {
						const owned = liveEntries(id, owner);
						if (owned.length > 1) {
							pre.push({
								service: id,
								error: { code: "ambiguous_service", message: `several instances: ${owned.map(e => e.name).join(", ")}; stop them one by one` },
							});
							continue;
						}
						const prev = owned[0];
						if (prev) stops.push(prev);
						const mode: Mode = debugSet ? (debugSet.has(id) ? "debug" : "normal") : (prev?.mode ?? "normal");
						reqs.push({
							service: id,
							mode,
							repo: params.repo_paths?.[id] ? repoOf(id) : (prev?.repo ?? repoOf(id)),
							explicitPort: ports?.[id] ?? prev?.port,
							explicitDebugPort: debugPorts?.[id] ?? (mode === "debug" ? (prev?.debugPort ?? undefined) : undefined),
							agentEnv: envOf?.[id] ?? prev?.agentEnv ?? {},
						});
					}
					const stopped = await stopTargets(stops);
					const started = await startAll(reqs, ctx, owner);
					services = [...pre, ...stopped, ...started];
					break;
				}
				case "stop": {
					const reports: Report[] = [];
					let targets: Entry[];
					if (list) {
						targets = [];
						for (const id of list) {
							const owned = [...ledger.values()].filter(e => e.service === id && e.ownerSessionId === owner);
							if (owned.length === 0) {
								reports.push({
									service: id,
									state: "not_stopped",
									error: { code: "not_owned", message: `${id} was not started by services in this session; it is never stopped` },
								});
							}
							targets.push(...owned);
						}
					} else {
						targets = [...ledger.values()].filter(e => e.ownerSessionId === owner);
					}
					services = [...reports, ...(await stopTargets(targets))];
					break;
				}
				case "status": {
					const wanted = new Set(list ?? SERVICE_IDS);
					services = await Promise.all(
						[...ledger.values()]
							.filter(e => wanted.has(e.service))
							.map(async e => {
								const isAlive = alive(-e.pgid);
								const info = psInfo(e.pid);
								const scheme = feScheme(e.agentEnv, process.env);
								let state = isAlive ? "running" : "gone";
								let health: { status: number; body: string } | null = null;
								if (isAlive && e.mode === "debug") {
									state = listeners(e.port).length > 0 ? "running" : "waiting_for_debugger";
								} else if (isAlive) {
									health = await curl(healthUrl(e.service, e.port, scheme));
									if (health.status === 200) state = "ready";
								}
								return {
									service: e.service,
									name: e.name,
									mode: e.mode,
									state,
									owned: e.ownerSessionId === owner,
									pid: e.pid,
									cwd: isAlive ? pidCwd(e.pid) : null,
									etime: info.etime,
									port: e.port,
									debug_port: e.debugPort,
									url: serviceUrl(e.service, e.port, scheme),
									health,
									log_file: e.logFile,
									error: null,
								} satisfies Report;
							}),
					);
					break;
				}
				case "logs": {
					if (!list || list.length !== 1) throw new Error("action logs needs exactly one service");
					const id = list[0];
					const found = [...ledger.values()].filter(e => e.service === id);
					if (found.length !== 1) {
						services = [
							{
								service: id,
								error:
									found.length === 0
										? { code: "not_owned", message: `${id} was not started by services in this OMP process` }
										: { code: "ambiguous_service", message: `several instances: ${found.map(e => e.name).join(", ")}` },
							},
						];
						break;
					}
					const e = found[0];
					const grep = params.grep ? new RegExp(params.grep) : undefined;
					services = [
						{
							service: id,
							name: e.name,
							log_file: e.logFile,
							text: lastLines(readLog(e, false), params.lines ?? 40, grep),
							error: null,
						},
					];
					break;
				}
			}
			const result = { action: params.action, services };
			return { content: [{ type: "text", text: JSON.stringify(result, null, 1) }], details: result };
		},
	});
}

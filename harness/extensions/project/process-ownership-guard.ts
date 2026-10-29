import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

// Enforces the RULES.md port rule: never stop, kill, or restart a process
// this task does not own. Prose alone did not hold (a lifecycle agent once
// killed a foreign media-mcp process).
//
// Owner = this OMP process. A top-level session and its in-process subagents
// share one ledger on globalThis, so a later call may stop a process that an
// earlier call in the same OMP process started. The services tool also
// writes to this ledger. The broker's own
// `owner` field is the starting session id, which dies with each subagent,
// so it cannot serve here. A process started by another terminal, a cron
// run, or an earlier OMP process is foreign; the user stops it by hand with
// `omp ps stop <name>` in their own terminal.

type Ledger = Map<string, { cwd: string; startedAt: number }>;

const LEDGER_KEY = Symbol.for("agent.processOwnershipGuard.ledger");
const g = globalThis as unknown as Record<symbol, Ledger | undefined>;
const ledger: Ledger = (g[LEDGER_KEY] ??= new Map());

const STOP_KEYS: Record<string, true> = { CTRL_C: true, CTRL_D: true };
const PREFIX_WORDS: Record<string, true> = { sudo: true, command: true, builtin: true, exec: true, nohup: true, time: true };
const KILL_COMMANDS: Record<string, true> = { kill: true, pkill: true, killall: true };

function real(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

function isInside(child: string, parent: string): boolean {
	const rel = relative(parent, child);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** The one ownership check for a named hub process, shared by `hub` and `omp ps`. */
function checkName(name: string): string | undefined {
	if (ledger.has(name)) return undefined;
	return (
		`process-ownership-guard: '${name}' was not started by this OMP session, so it is foreign. ` +
		"Never stop, kill, or restart a foreign process (RULES.md). Pick another port or process name. " +
		`If it is really an orphan, the user can stop it in their own terminal with: omp ps stop ${name}`
	);
}

function run(file: string, args: string[]): string | undefined {
	try {
		return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 });
	} catch {
		return undefined;
	}
}

function isDescendantOfSelf(pid: number): boolean {
	let current = pid;
	for (let i = 0; i < 64 && current > 1; i++) {
		if (current === process.pid) return true;
		const out = run("ps", ["-o", "ppid=", "-p", String(current)]);
		const parent = out ? Number.parseInt(out.trim(), 10) : Number.NaN;
		if (!Number.isFinite(parent)) return false;
		current = parent;
	}
	return false;
}

function processCwd(pid: number): string | undefined {
	const out = run("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
	const line = out?.split("\n").find(l => l.startsWith("n"));
	return line ? real(line.slice(1)) : undefined;
}

/** Ledger directories specific enough to prove ownership by working directory. */
function ownedDirs(sessionCwd: string): string[] {
	const root = real(sessionCwd);
	const broad = [root, real(homedir()), "/"];
	const dirs: string[] = [];
	for (const { cwd } of ledger.values()) {
		if (broad.some(b => isInside(b, cwd))) continue; // cwd is root, home, or an ancestor of them
		dirs.push(cwd);
	}
	return dirs;
}

function checkPid(pid: number, sessionCwd: string): string | undefined {
	if (isDescendantOfSelf(pid)) return undefined;
	const cwd = processCwd(pid);
	if (cwd && ownedDirs(sessionCwd).some(dir => isInside(cwd, dir))) return undefined;
	return (
		`process-ownership-guard: PID ${pid} (cwd ${cwd ?? "unknown"}) is not a child of this OMP session ` +
		"and does not run inside a directory of a process this session started. " +
		"Never kill a foreign process (RULES.md). Use hub stop on a process this session started."
	);
}

function stripPrefix(tokens: string[]): string[] {
	let i = 0;
	while (i < tokens.length && (PREFIX_WORDS[tokens[i]] || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))) i++;
	return tokens.slice(i);
}

/** Returns a block reason for one shell segment, or undefined when it is allowed. */
function checkSegment(segment: string, sessionCwd: string): string | undefined {
	const tokens = stripPrefix(segment.trim().split(/\s+/).filter(Boolean));
	if (tokens.length === 0) return undefined;
	const head = tokens[0].slice(tokens[0].lastIndexOf("/") + 1);

	if (head === "xargs" && tokens.slice(1).some(t => KILL_COMMANDS[t.slice(t.lastIndexOf("/") + 1)])) {
		return "process-ownership-guard: 'xargs kill' has no literal targets, so ownership cannot be proved. Use literal PIDs.";
	}
	if (head === "pkill" || head === "killall") {
		return `process-ownership-guard: '${head}' matches by pattern, so ownership cannot be proved. Use kill with literal PIDs.`;
	}
	if (head === "omp" && tokens[1] === "ps" && ["stop", "kill", "restart"].includes(tokens[2] ?? "")) {
		const name = tokens.slice(3).find(t => !t.startsWith("-"));
		if (!name) return "process-ownership-guard: 'omp ps' action without a literal process name.";
		return checkName(name);
	}
	if (head !== "kill") return undefined;

	let signalSeen = false;
	let flagsDone = false;
	let targets = 0;
	for (let i = 1; i < tokens.length; i++) {
		const t = tokens[i];
		if (!flagsDone) {
			if (t === "--") {
				flagsDone = true;
				continue;
			}
			if (t === "-l" || t === "-L") return undefined; // lists signals, kills nothing
			if (t === "-s" || t === "-n") {
				i++;
				signalSeen = true;
				continue;
			}
			if (t.startsWith("-") && !signalSeen) {
				signalSeen = true;
				continue;
			}
		}
		targets++;
		if (/^%\S+$/.test(t)) continue; // shell job spec: a job of this session's own shell
		if (!/^\d+$/.test(t)) {
			return `process-ownership-guard: kill target '${t}' is not a literal PID (process groups, variables, and substitutions are refused).`;
		}
		const reason = checkPid(Number.parseInt(t, 10), sessionCwd);
		if (reason) return reason;
	}
	// The splitter cuts `kill -9 $(lsof -ti :8001)` and `xargs -I{} kill {}` down to a
	// bare `kill`, so a kill with no literal target is a substitution. A real bare
	// `kill` kills nothing, so refusing it breaks no valid use.
	if (targets === 0) {
		return "process-ownership-guard: kill has no literal PID (a $(...), backtick, or xargs substitution). Resolve the PIDs, prove ownership, then kill them by number.";
	}
	return undefined;
}

export function checkBash(command: string, sessionCwd: string): string | undefined {
	for (const segment of command.split(/&&|\|\||\$\(|[;&|\n()`{}]/)) {
		const reason = checkSegment(segment, sessionCwd);
		if (reason) return reason;
	}
	return undefined;
}

function checkHub(input: Record<string, unknown>): string | undefined {
	const op = input.op;
	const name = typeof input.name === "string" ? input.name : undefined;
	const stopsProcess =
		op === "stop" ||
		op === "restart" ||
		(op === "send" &&
			name !== undefined &&
			(input.signal !== undefined || (Array.isArray(input.keys) && input.keys.some(k => STOP_KEYS[String(k)]))));
	if (!stopsProcess || name === undefined) return undefined;
	return checkName(name);
}

export default function processOwnershipGuard(pi: ExtensionAPI): void {
	pi.setLabel("Process ownership guard");

	pi.on("tool_call", async (event, ctx) => {
		const input = event.input as Record<string, unknown>;
		let reason: string | undefined;
		if (event.toolName === "hub") reason = checkHub(input);
		else if (event.toolName === "bash" && typeof input.command === "string") reason = checkBash(input.command, ctx.cwd);
		if (reason) return { block: true, reason };
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "hub" || event.isError) return;
		const input = event.input;
		if (typeof input.name !== "string") return;
		if (input.op === "stop") {
			ledger.delete(input.name); // a later process under the same name is not ours
			return;
		}
		if (input.op !== "start") return;
		const details = event.details as { daemon?: { state?: string } } | undefined;
		if (details?.daemon?.state === "failed") return;
		const cwd = typeof input.cwd === "string" ? input.cwd : ctx.cwd;
		ledger.set(input.name, { cwd: real(resolve(ctx.cwd, cwd)), startedAt: Date.now() });
	});
}

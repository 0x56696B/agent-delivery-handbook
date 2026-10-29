// Service table and pure planning logic for the services tool.
// The argv, ports, and wiring rules here are authoritative. The reasons
// behind each one live in the service-startup-reference skill.

export const SERVICE_IDS = ["file-gateway", "media-mcp", "data-mcp", "orchestrator", "web-app"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];
export type Mode = "normal" | "debug";

export interface ServiceDef {
	id: ServiceId;
	repoDir: string;
	port: number;
	/** Absent: debug mode is not supported (web-app; use browser DevTools). */
	debugPort?: number;
	python: boolean;
}

export const SERVICES: Record<ServiceId, ServiceDef> = {
	"file-gateway": { id: "file-gateway", repoDir: "file-gateway", port: 9000, debugPort: 5681, python: true },
	"media-mcp": { id: "media-mcp", repoDir: "media-mcp", port: 8001, debugPort: 5680, python: true },
	"data-mcp": { id: "data-mcp", repoDir: "data-mcp", port: 8002, debugPort: 5679, python: true },
	"orchestrator": { id: "orchestrator", repoDir: "orchestrator", port: 8000, debugPort: 5678, python: true },
	"web-app": { id: "web-app", repoDir: "web-app", port: 5173, python: false },
};

/** Start order. Services inside one phase start in parallel. */
export const PHASES: ServiceId[][] = [["file-gateway", "media-mcp", "data-mcp"], ["orchestrator"], ["web-app"]];

/** Siblings each service reads its URLs from. A failed sibling skips the dependent. */
export const WIRES_TO: Record<ServiceId, ServiceId[]> = {
	"file-gateway": [],
	"media-mcp": [],
	"data-mcp": [],
	"orchestrator": ["media-mcp", "data-mcp"],
	"web-app": ["orchestrator", "file-gateway"],
};

/** Canonical service and debug ports. An auto-picked port never lands on one. */
export const RESERVED: Record<number, true> = {
	8000: true,
	8001: true,
	8002: true,
	9000: true,
	5173: true,
	5678: true,
	5679: true,
	5680: true,
	5681: true,
};

export const READY_TIMEOUT_MS = 60_000;
export const PORT_SCAN_SPAN = 99;

export const AADSTS_WARNING = "login will fail with AADSTS50011: Entra only allows https://localhost:5173/callback";

/** Expand `"all"` or a list into unique ids in start order. */
export function expandServices(services: "all" | ServiceId[]): ServiceId[] {
	const wanted = services === "all" ? new Set(SERVICE_IDS) : new Set(services);
	return PHASES.flat().filter(id => wanted.has(id));
}

export type PickResult = { port: number; autoPicked: boolean } | { error: "port_in_use" | "no_free_port"; port: number };

/**
 * Pick a listen port. An explicit port, or any port for a strict service, is
 * used as given or fails. Otherwise the canonical port is used when free, and
 * the scan moves up from it, skipping reserved and already-taken ports.
 */
export function pickPort(
	canonical: number,
	explicit: number | undefined,
	strict: boolean,
	isBusy: (port: number) => boolean,
	taken: Set<number>,
): PickResult {
	if (explicit !== undefined || strict) {
		const port = explicit ?? canonical;
		return taken.has(port) || isBusy(port) ? { error: "port_in_use", port } : { port, autoPicked: false };
	}
	if (!taken.has(canonical) && !isBusy(canonical)) return { port: canonical, autoPicked: false };
	for (let port = canonical + 1; port <= canonical + PORT_SCAN_SPAN; port++) {
		if (RESERVED[port] || taken.has(port)) continue;
		if (!isBusy(port)) return { port, autoPicked: true };
	}
	return { error: "no_free_port", port: canonical };
}

export type WiringSource = "this_call" | "running" | "canonical" | "self" | "agent_env";

export interface WiringEntry {
	var: string;
	value: string;
	source: WiringSource;
}

export interface SiblingPort {
	port: number;
	source: "this_call" | "running";
}

export interface EnvOptions {
	/** Sibling ports started in this call or running under this session. Missing siblings use the canonical port. */
	siblings: Partial<Record<ServiceId, SiblingPort>>;
	/** Agent `env` for this service. Wins over every computed value. */
	agentEnv?: Record<string, string>;
	/** Inherited process env, used only to read `VITE_DEV_HTTPS`. */
	inheritedEnv?: Record<string, string | undefined>;
}

export interface EnvPlan {
	env: Record<string, string>;
	wiring: WiringEntry[];
	overridden: string[];
	warnings: string[];
}

/** Scheme the Vite dev server serves on, from the effective `VITE_DEV_HTTPS`. */
export function feScheme(agentEnv?: Record<string, string>, inheritedEnv?: Record<string, string | undefined>): "http" | "https" {
	const value = agentEnv?.VITE_DEV_HTTPS ?? inheritedEnv?.VITE_DEV_HTTPS;
	return value === "false" ? "http" : "https";
}

/** Fixed env, then computed wiring, then the agent `env`. */
export function buildEnv(service: ServiceId, port: number, opts: EnvOptions): EnvPlan {
	const computed: Record<string, string> = {};
	const wiring: WiringEntry[] = [];
	const warnings: string[] = [];

	if (service === "orchestrator") {
		computed.ENV = "local";
		computed.PORT = String(port);
	}

	const agentEnv = opts.agentEnv ?? {};
	const wire = (name: string, sibling: ServiceId, url: (siblingPort: number) => string) => {
		const found = opts.siblings[sibling];
		const siblingPort = found?.port ?? SERVICES[sibling].port;
		computed[name] = url(siblingPort);
		if (name in agentEnv) {
			wiring.push({ var: name, value: agentEnv[name], source: "agent_env" });
			return;
		}
		if (!found) warnings.push(`${sibling} not started by services; wired to canonical port ${siblingPort}`);
		wiring.push({ var: name, value: computed[name], source: found?.source ?? "canonical" });
	};

	if (service === "orchestrator") {
		wire("AGENT_MCP_IMAGE_GENERATION_URL", "media-mcp", p => `http://localhost:${p}/mcp`);
		wire("AGENT_MCP_DATA_URL", "data-mcp", p => `http://localhost:${p}/mcp`);
	}
	if (service === "web-app") {
		wire("VITE_ORCHESTRATOR_BASE_URL", "orchestrator", p => `http://localhost:${p}`);
		wire("VITE_FILES_BASE_URL", "file-gateway", p => `http://localhost:${p}`);
		if (port !== SERVICES["web-app"].port) {
			const scheme = feScheme(opts.agentEnv, opts.inheritedEnv);
			for (const [name, value] of [
				["VITE_OIDC_REDIRECT_URI", `${scheme}://localhost:${port}/callback`],
				["VITE_OIDC_POST_LOGOUT_REDIRECT_URI", `${scheme}://localhost:${port}/`],
			] as const) {
				computed[name] = value;
				wiring.push(name in agentEnv ? { var: name, value: agentEnv[name], source: "agent_env" } : { var: name, value, source: "self" });
			}
			warnings.push(AADSTS_WARNING);
		}
	}

	const overridden = Object.keys(agentEnv).filter(key => key in computed);
	return { env: { ...computed, ...agentEnv }, wiring, overridden, warnings };
}

export interface ProcessSpec {
	application: string;
	args: string[];
	/** Normal mode only. Debug mode has no gate: a probe would burn debugpy's one client slot. */
	ready?: { log: string; timeoutMs: number };
}

export function buildSpec(service: ServiceId, mode: Mode, port: number, debugPort: number | null): ProcessSpec {
	if (service === "web-app") {
		if (mode === "debug") throw new Error("web-app has no debug mode");
		return {
			application: "pnpm",
			args: ["exec", "vite", "--port", String(port), "--strictPort"],
			ready: { log: "Local:.*https?://", timeoutMs: READY_TIMEOUT_MS },
		};
	}
	if (mode === "debug") {
		if (debugPort === null) throw new Error(`${service} debug mode needs a debug port`);
		const module = service === "orchestrator" ? "app.main:app" : "src.main:app";
		// media-mcp declares debugpy itself; the other 3 repos need `--with debugpy`.
		const withDebugpy = service === "media-mcp" ? [] : ["--with", "debugpy"];
		return {
			application: "uv",
			args: [
				"run",
				...withDebugpy,
				"python",
				"-m",
				"debugpy",
				"--listen",
				`0.0.0.0:${debugPort}`,
				"--wait-for-client",
				"-m",
				"uvicorn",
				module,
				"--host",
				"0.0.0.0",
				"--port",
				String(port),
			],
		};
	}
	const ready = { log: `Uvicorn running on http://0\\.0\\.0\\.0:${port}`, timeoutMs: READY_TIMEOUT_MS };
	if (service === "orchestrator") return { application: "uv", args: ["run", "python", "-m", "app"], ready };
	const reload = service === "data-mcp" ? [] : ["--reload"];
	return {
		application: "uv",
		args: ["run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", String(port), ...reload],
		ready,
	};
}

export function healthUrl(service: ServiceId, port: number, scheme: "http" | "https"): string {
	return service === "web-app" ? `${scheme}://localhost:${port}/` : `http://localhost:${port}/health`;
}

export function serviceUrl(service: ServiceId, port: number, scheme: "http" | "https"): string {
	return service === "web-app" ? `${scheme}://localhost:${port}` : `http://localhost:${port}`;
}

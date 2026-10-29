import { describe, expect, test } from "bun:test";
import { AADSTS_WARNING, buildEnv, pickPort } from "./plan";

const busyOnly = (...ports: number[]) => (p: number) => ports.includes(p);

describe("pickPort", () => {
	test("canonical free: canonical", () => {
		expect(pickPort(8002, undefined, false, busyOnly(), new Set())).toEqual({ port: 8002, autoPicked: false });
	});

	test("canonical busy: next free port", () => {
		expect(pickPort(8002, undefined, false, busyOnly(8002), new Set())).toEqual({ port: 8003, autoPicked: true });
	});

	test("scan skips reserved canonical ports", () => {
		expect(pickPort(8000, undefined, false, busyOnly(8000), new Set())).toEqual({ port: 8003, autoPicked: true });
	});

	test("explicit busy port: port_in_use, no scan", () => {
		expect(pickPort(8002, 8012, false, busyOnly(8012), new Set())).toEqual({ error: "port_in_use", port: 8012 });
	});

	test("strict service with busy canonical port: port_in_use", () => {
		expect(pickPort(5173, undefined, true, busyOnly(5173), new Set())).toEqual({ error: "port_in_use", port: 5173 });
	});

	test("every scanned port busy: no_free_port", () => {
		expect(pickPort(8002, undefined, false, () => true, new Set())).toEqual({ error: "no_free_port", port: 8002 });
	});

	test("ports taken earlier in the same call are skipped", () => {
		expect(pickPort(8002, undefined, false, busyOnly(8002), new Set([8003, 8004]))).toEqual({
			port: 8005,
			autoPicked: true,
		});
	});
});

describe("buildEnv", () => {
	test("agent env beats computed wiring, is listed in overridden, and drops the canonical warning", () => {
		const plan = buildEnv("orchestrator", 8000, {
			siblings: { "data-mcp": { port: 8012, source: "this_call" } },
			agentEnv: { AGENT_MCP_IMAGE_GENERATION_URL: "http://localhost:8999/mcp" },
		});
		expect(plan.env.AGENT_MCP_IMAGE_GENERATION_URL).toBe("http://localhost:8999/mcp");
		expect(plan.env.AGENT_MCP_DATA_URL).toBe("http://localhost:8012/mcp");
		expect(plan.overridden).toEqual(["AGENT_MCP_IMAGE_GENERATION_URL"]);
		expect(plan.wiring.find(w => w.var === "AGENT_MCP_IMAGE_GENERATION_URL")).toEqual({
			var: "AGENT_MCP_IMAGE_GENERATION_URL",
			value: "http://localhost:8999/mcp",
			source: "agent_env",
		});
		expect(plan.warnings).toEqual([]);
	});

	test("orchestrator always runs with ENV=local", () => {
		expect(buildEnv("orchestrator", 8000, { siblings: {} }).env.ENV).toBe("local");
	});

	test("web-app off 5173 gets both OIDC vars and the Entra warning", () => {
		const plan = buildEnv("web-app", 5174, {
			siblings: { "orchestrator": { port: 8000, source: "running" }, "file-gateway": { port: 9000, source: "running" } },
		});
		expect(plan.env.VITE_OIDC_REDIRECT_URI).toBe("https://localhost:5174/callback");
		expect(plan.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI).toBe("https://localhost:5174/");
		expect(plan.warnings).toContain(AADSTS_WARNING);
	});

	test("web-app with VITE_DEV_HTTPS=false uses http redirect URIs", () => {
		const plan = buildEnv("web-app", 5174, { siblings: {}, agentEnv: { VITE_DEV_HTTPS: "false" } });
		expect(plan.env.VITE_OIDC_REDIRECT_URI).toBe("http://localhost:5174/callback");
	});

	test("sibling not started by the tool: canonical port with a warning", () => {
		const plan = buildEnv("web-app", 5173, { siblings: { "file-gateway": { port: 9001, source: "this_call" } } });
		expect(plan.env.VITE_ORCHESTRATOR_BASE_URL).toBe("http://localhost:8000");
		expect(plan.wiring.find(w => w.var === "VITE_ORCHESTRATOR_BASE_URL")?.source).toBe("canonical");
		expect(plan.warnings).toContain("orchestrator not started by services; wired to canonical port 8000");
		expect(plan.env.VITE_FILES_BASE_URL).toBe("http://localhost:9001");
	});
});

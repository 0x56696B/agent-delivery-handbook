/**
 * vibe-extra-tools.ts. Global: loaded in every omp session.
 *
 * Vibe mode cuts the director toolset to `read`, optional `todo`, and the
 * `vibe_*` tools (interactive-mode.ts `#enterVibeMode`, hardcoded). No setting
 * changes that list and no extension event fires on vibe entry.
 *
 * Config: `vibeExtraTools`, a list of exact tool names, in
 * ~/.omp/agent/config.yml and in <cwd>/.omp/config.yml. The two lists are
 * unioned. The key is not a harness setting: unknown keys are carried and
 * ignored (config/settings.ts RawSettings). Example, in a project config:
 *
 *   vibeExtraTools:
 *     - services
 *
 * Mechanism: `before_agent_start` runs before every prompt, including the first
 * prompt of `/vibe <prompt>`. When `vibe_spawn` is active, each configured tool
 * that exists but is not active gets added to the active set. Config is read on
 * every prompt, so an edit applies on the next prompt with no restart. Core code
 * adds `computer` and `think` the same way. Vibe exit restores the pre-vibe set.
 *
 * Limit: the system prompt for the first vibe turn is built before this hook
 * runs, so it may not list the added tools. A hidden note in the same turn names
 * them. A configured name that is not a registered tool is skipped silently.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const CONFIG_KEY = "vibeExtraTools";
const USER_CONFIG = join(homedir(), ".omp", "agent", "config.yml");

type Layer = { tools: string[]; error?: string };

function readLayer(path: string): Layer {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return { tools: [] };
		return { tools: [], error: `${path}: ${err instanceof Error ? err.message : String(err)}` };
	}
	try {
		const parsed = Bun.YAML.parse(text);
		if (typeof parsed !== "object" || parsed === null) return { tools: [] };
		const value = (parsed as Record<string, unknown>)[CONFIG_KEY];
		if (value === undefined || value === null) return { tools: [] };
		if (!Array.isArray(value) || value.some(v => typeof v !== "string")) {
			return { tools: [], error: `${path}: '${CONFIG_KEY}' must be a list of tool names` };
		}
		return { tools: value as string[] };
	} catch (err) {
		return { tools: [], error: `${path}: ${err instanceof Error ? err.message : String(err)}` };
	}
}

/** Union of the user layer and the project layer. Order: user first, then project. */
export function loadExtraTools(cwd: string): { tools: string[]; errors: string[] } {
	const layers = [readLayer(USER_CONFIG), readLayer(join(cwd, ".omp", "config.yml"))];
	return {
		tools: [...new Set(layers.flatMap(l => l.tools))],
		errors: layers.flatMap(l => (l.error ? [l.error] : [])),
	};
}

export default function vibeExtraTools(pi: ExtensionAPI): void {
	pi.setLabel("Vibe extra tools");
	const reportedErrors = new Set<string>();

	pi.on("before_agent_start", async (_event, ctx) => {
		const active = pi.getActiveTools();
		if (!active.includes("vibe_spawn")) return;

		const { tools, errors } = loadExtraTools(ctx.cwd);
		if (ctx.hasUI) {
			for (const error of errors) {
				if (reportedErrors.has(error)) continue;
				reportedErrors.add(error);
				ctx.ui.notify(`vibe-extra-tools: ${error}`, "warning");
			}
		}

		const registered = new Set(pi.getAllTools().map(t => t.name));
		const missing = tools.filter(name => registered.has(name) && !active.includes(name));
		if (missing.length === 0) return;

		await pi.setActiveTools([...active, ...missing]);
		const list = missing.map(name => `\`${name}\``).join(", ");
		return {
			message: {
				customType: "vibe-extra-tools",
				display: false,
				content:
					`These tools are also available in vibe mode: ${list}. You, the director, ` +
					"MAY call them yourself. The rule against running things yourself does not " +
					"cover them. Do not delegate their use to workers.",
			},
		};
	});
}

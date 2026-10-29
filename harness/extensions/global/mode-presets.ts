/**
 * mode-presets.ts. Global: loaded in every omp session.
 *
 * One key sets the main-agent model and a full mode state (plan, vibe, goal).
 * Keys: Cmd+Ctrl+0..4 (see PRESETS). Ghostty sends Cmd+Ctrl+N as CSI-u
 * `super+ctrl` (keybinds in ~/.config/ghostty/config). tmux turns super into
 * Alt, so omp receives `ctrl+alt+N`, and that is the key ID bound here.
 * Plain Ctrl+N cannot be used: Ghostty sends a plain digit. Verified with
 * `printf '\e[>4;2m'; cat -v` in tmux: Cmd+Ctrl+1 gives `^[[49;7u`.
 * The harness binds the keys through `pi.registerShortcut`.
 *
 * Mechanism: the public extension API can set the model (`pi.setModel`) but
 * cannot change modes. So the extension gets the live composer and calls its
 * `onSubmit("/plan")`, `onSubmit("/vibe")` or `onSubmit("/goal ...")`. This is
 * the same path as typing the command and pressing Enter. The composer comes
 * from a probe widget: `ctx.ui.setWidget` calls the factory synchronously with
 * the live TUI, and `tui.getFocused()` returns the composer while a shortcut
 * handler runs (extension-ui-controller.ts `#createHookWidget`, input-controller.ts
 * `registerExtensionShortcuts`, `setupEditorSubmitHandler`).
 *
 * Mode semantics (interactive-mode.ts `handlePlanModeCommand`,
 * `handleVibeModeCommand`, `handleGoalModeCommand`): each command refuses while
 * another mode is on or paused. So a preset walks the TRANSITIONS graph from the
 * current journal mode to the target. The current mode is read from the last
 * `mode_change` session entry. The walk re-reads the mode before every step,
 * because a confirm dialog can leave the session in any state.
 *
 * Plan mode can be on at startup (`plan.defaultOnStartup`). Then a vibe preset
 * runs `/plan`, `/plan`, `/vibe`.
 *
 * Add a preset: one PRESETS row. Cmd+Ctrl+5..9 (`ctrl+alt+5`..`ctrl+alt+9`) are free.
 * Add a state to a feature: add it to FEATURES[].states and add the TRANSITIONS
 *   rows that reach and leave it. The journal string is `<feature>_<state>`.
 * Add a feature: one FEATURES row, its TRANSITIONS rows, and a `<feature>: "off"`
 *   entry in OFF.
 *
 * Limits: presets do not set the thinking level (`setModel` applies the model's
 * own default). A focused-subagent composer cannot be detected through the
 * extension API. Model changes are session-only; config.yml is not changed.
 * Only `import type` from the omp package works in the compiled binary.
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

/** One mode feature. `states[0]` must be "off". */
interface Feature {
	name: string;
	states: readonly string[];
}

const FEATURES = [
	{ name: "plan", states: ["off", "on", "paused"] },
	{ name: "vibe", states: ["off", "on"] },
	{ name: "goal", states: ["off", "on", "paused"] },
] as const satisfies readonly Feature[];

type FeatureName = (typeof FEATURES)[number]["name"];
type FeatureState<N extends FeatureName> = Extract<(typeof FEATURES)[number], { name: N }>["states"][number];
/** Full mode state: one value for every feature. */
type ModeState = { [N in FeatureName]: FeatureState<N> };

/** One slash command that moves the session from one journal mode to another. */
interface Transition {
	from: string; // journal mode before (see journalMode)
	to: string; // journal mode after
	command: string; // exact text passed to composer.onSubmit
	applyModelFirst?: true; // set the preset model before this command
	note?: string; // why the edge exists / what UI it opens
}

const TRANSITIONS: readonly Transition[] = [
	{
		from: "none",
		to: "plan",
		command: "/plan",
		applyModelFirst: true,
		note: "plan entry stores the current model and restores it on exit",
	},
	{ from: "plan", to: "plan_paused", command: "/plan", note: "confirm dialog when the plan file has content" },
	{ from: "plan_paused", to: "none", command: "/plan" },
	{ from: "none", to: "vibe", command: "/vibe" },
	{ from: "vibe", to: "none", command: "/vibe" },
	{ from: "none", to: "goal", command: "/goal", note: "opens the goal objective editor" },
	{ from: "goal", to: "goal_paused", command: "/goal pause" },
	{ from: "goal_paused", to: "goal", command: "/goal resume" },
	{ from: "goal", to: "none", command: "/goal drop", note: "confirm dialog" },
	{ from: "goal_paused", to: "none", command: "/goal drop", note: "confirm dialog" },
];

interface Preset {
	key: string;
	label: string;
	model: string;
	modes: ModeState;
}

const OFF: ModeState = { plan: "off", vibe: "off", goal: "off" };
// Key IDs are what omp receives: `ctrl+alt+N` is Cmd+Ctrl+N (see header).
const PRESETS: readonly Preset[] = [
	{ key: "ctrl+alt+0", label: "Default agent", model: "@default", modes: { ...OFF } },
	{ key: "ctrl+alt+1", label: "Opus + plan mode", model: "anthropic/claude-opus-5-5", modes: { ...OFF, plan: "on" } },
	{ key: "ctrl+alt+2", label: "Opus + vibe mode", model: "anthropic/claude-opus-5-5", modes: { ...OFF, vibe: "on" } },
	{ key: "ctrl+alt+3", label: "Sonnet", model: "anthropic/claude-sonnet-5-5", modes: { ...OFF } },
	{ key: "ctrl+alt+4", label: "Sonnet + vibe mode", model: "anthropic/claude-sonnet-5-5", modes: { ...OFF, vibe: "on" } },
];

const MAX_STEPS = 6;
const PROBE_WIDGET = "mode-presets-probe";

let tuiRef: { getFocused(): unknown } | undefined;
let busy = false;

interface Composer {
	onSubmit(text: string): unknown;
}

/** Journal string for a mode state, or "none" when every feature is off. */
function journalMode(state: ModeState): string {
	for (const feature of FEATURES) {
		const value: string = state[feature.name];
		if (value === "off") continue;
		return value === "on" ? feature.name : `${feature.name}_${value}`;
	}
	return "none";
}

/** Inverse of journalMode. `undefined` for an unknown feature or state. */
function parseJournalMode(mode: string): ModeState | undefined {
	if (mode === "none") return { ...OFF };
	const cut = mode.indexOf("_");
	const name = cut === -1 ? mode : mode.slice(0, cut);
	const suffix = cut === -1 ? "on" : mode.slice(cut + 1);
	const feature = FEATURES.find(f => f.name === name);
	if (!feature) return undefined;
	if (suffix === "off" || !(feature.states as readonly string[]).includes(suffix)) return undefined;
	return { ...OFF, [feature.name]: suffix } as ModeState;
}

/** Shortest edge list from `from` to `to` (BFS). `[]` when equal, `undefined` when unreachable. */
function findPath(from: string, to: string): Transition[] | undefined {
	if (from === to) return [];
	const previous = new Map<string, Transition>();
	const seen = new Set<string>([from]);
	const queue: string[] = [from];
	while (queue.length > 0) {
		const node = queue.shift() as string;
		for (const edge of TRANSITIONS) {
			if (edge.from !== node || seen.has(edge.to)) continue;
			seen.add(edge.to);
			previous.set(edge.to, edge);
			if (edge.to === to) {
				const path: Transition[] = [];
				let cursor = to;
				while (cursor !== from) {
					const step = previous.get(cursor) as Transition;
					path.unshift(step);
					cursor = step.from;
				}
				return path;
			}
			queue.push(edge.to);
		}
	}
	return undefined;
}

function validatePresets(): void {
	for (const edge of TRANSITIONS) {
		for (const mode of [edge.from, edge.to]) {
			if (!parseJournalMode(mode)) throw new Error(`mode-presets: unknown mode ${mode} in TRANSITIONS`);
		}
	}
	const keys = new Set<string>();
	for (const preset of PRESETS) {
		if (keys.has(preset.key)) throw new Error(`mode-presets: duplicate key ${preset.key}`);
		keys.add(preset.key);
		if (FEATURES.filter(f => preset.modes[f.name] !== "off").length > 1) {
			throw new Error(`mode-presets: preset ${preset.label} has more than one active mode`);
		}
		const target = journalMode(preset.modes);
		if (!findPath("none", target) || !findPath(target, "none")) {
			throw new Error(`mode-presets: no transition path between none and ${target} for preset ${preset.label}`);
		}
	}
}

/** Last `mode_change` journal mode on the current branch, or "none". */
function currentMode(ctx: ExtensionContext): string {
	const branch = ctx.sessionManager.getBranch() as ReadonlyArray<{ type: string; mode?: string }>;
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "mode_change" && typeof entry.mode === "string") return entry.mode;
	}
	return "none";
}

function describe(state: ModeState): string {
	return FEATURES.map(f => `${f.name} ${state[f.name]}`).join(", ");
}

function getComposer(ctx: ExtensionContext): Composer | undefined {
	if (!tuiRef) {
		ctx.ui.setWidget(PROBE_WIDGET, tui => {
			tuiRef = tui as unknown as { getFocused(): unknown };
			return { render: () => [], invalidate: () => {} };
		});
		ctx.ui.setWidget(PROBE_WIDGET, undefined);
	}
	const focused = tuiRef?.getFocused() as Partial<Composer> | undefined | null;
	return focused && typeof focused.onSubmit === "function" ? (focused as Composer) : undefined;
}

async function applyModel(pi: ExtensionAPI, ctx: ExtensionContext, preset: Preset): Promise<boolean> {
	const model = ctx.models.resolve(preset.model);
	if (!model) {
		ctx.ui.notify(`${preset.label}: model ${preset.model} not found`, "error");
		return false;
	}
	if (!(await pi.setModel(model))) {
		ctx.ui.notify(`${preset.label}: no API key for ${preset.model}`, "error");
		return false;
	}
	return true;
}

async function runPreset(pi: ExtensionAPI, ctx: ExtensionContext, preset: Preset): Promise<void> {
	if (ctx.mode !== "tui") return;
	if (busy) return;
	busy = true;
	try {
		if (!ctx.isIdle()) {
			ctx.ui.notify(`${preset.label}: wait until the agent is idle`, "warning");
			return;
		}
		const composer = getComposer(ctx);
		if (!composer) {
			ctx.ui.notify(`${preset.label}: composer not available`, "error");
			return;
		}
		const target = journalMode(preset.modes);
		for (let step = 0; step < MAX_STEPS; step++) {
			const mode = currentMode(ctx);
			if (mode === target) break;
			if (!parseJournalMode(mode)) {
				ctx.ui.notify(`${preset.label}: unknown mode ${mode}`, "error");
				return;
			}
			const path = findPath(mode, target);
			if (!path) {
				ctx.ui.notify(`${preset.label}: no way from ${mode} to ${target}`, "error");
				return;
			}
			const edge = path[0];
			if (edge.applyModelFirst && !(await applyModel(pi, ctx, preset))) return;
			await composer.onSubmit(edge.command);
			if (currentMode(ctx) !== edge.to) {
				ctx.ui.notify(`${preset.label}: stopped at ${mode}`, "warning");
				return;
			}
		}
		if (currentMode(ctx) !== target) {
			ctx.ui.notify(`${preset.label}: could not reach ${describe(preset.modes)}`, "error");
			return;
		}
		// Plan exit restores the pre-plan model, so the final model is set last.
		if (await applyModel(pi, ctx, preset)) {
			ctx.ui.notify(`${preset.label}: ${describe(preset.modes)}`, "info");
		}
	} finally {
		busy = false;
	}
}

export default function modePresets(pi: ExtensionAPI): void {
	validatePresets();
	pi.setLabel("Mode presets");
	for (const preset of PRESETS) {
		pi.registerShortcut(preset.key as never, {
			description: `Preset: ${preset.label}`,
			handler: ctx => {
				void runPreset(pi, ctx, preset).catch(err =>
					ctx.ui.notify(`${preset.label}: ${err instanceof Error ? err.message : String(err)}`, "error"),
				);
			},
		});
	}
}

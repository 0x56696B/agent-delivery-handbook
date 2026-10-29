import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { homedir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";

// Enforces RULES.md: a session started under ~/work/<PROJECT>/tasks never touches
// anything else under ~/work/<PROJECT> (the *-bare repos, the bare .env files, ...).
// The old TTSR rule matched the partial stream buffer, so a half-streamed
// `/work/<PROJECT>/ta` fired it on plain tasks/ paths. This guard runs on the final
// tool arguments instead.
//
// Checks are LEXICAL (path.resolve, no symlink resolution). Task-folder repo
// symlinks resolve into ~/work/<PROJECT>/<repo>-bare/..., and the rule mandates
// access through them, so realpath would block the allowed path.
//
// Known limit: bash is parsed heuristically. Paths built at run time
// ($VAR, command substitution, a script that reads the parent itself) and
// inline python/node source are not seen.

// Directory name under ~/work that holds `tasks/` and the `<repo>-bare` clones.
// Set this to your project folder name (the `<PROJECT>` in ~/work/<PROJECT>/tasks).
const PROJECT_DIR = "<PROJECT>";

const BLOCK_HINT =
	`Do not touch ~/work/${PROJECT_DIR} outside tasks/ (bare repos, parent .env files). ` +
	"Use the task-folder repo symlinks and `git -C <task-folder>/<repo>`. " +
	"For code from main, use the `main` folder inside tasks/. If it does not exist, tell the user.";

const PATH_KEY = /path|file|dir|cwd|program|root|dest|target|source/i;
const SEGMENT_SPLIT = /&&|\|\||\$\(|[;&|\n()`{}]/;
const RECURSIVE_BIN: Record<string, true> = { find: true, rg: true, fd: true, tree: true, du: true, ag: true, ack: true, locate: true, mdfind: true };
const NON_WALKING_TOOLS: Record<string, true> = { read: true, edit: true, write: true, lsp: true };

/** The `<...>/work/<PROJECT>` and `<...>/work/<PROJECT>/tasks` roots for a session cwd, or undefined when the guard does not apply. */
export function rootsFor(cwd: string): { root: string; tasks: string } | undefined {
	const parts = resolve(cwd).split(sep);
	for (let i = 1; i < parts.length - 1; i++) {
		if (parts[i] === PROJECT_DIR && parts[i + 1] === "tasks" && parts[i - 1] === "work") {
			const root = parts.slice(0, i + 1).join(sep) || sep;
			return { root, tasks: `${root}${sep}tasks` };
		}
	}
	return undefined;
}

function within(child: string, parent: string): boolean {
	return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}

function expand(raw: string): string {
	const home = homedir();
	let p = raw.replace(/^\$\{?HOME\}?(?=\/|$)/, home);
	if (p === "~" || p.startsWith("~/")) p = home + p.slice(1);
	return p;
}

/**
 * Returns the offending resolved path when `raw` points into ~/work/<PROJECT> outside tasks/.
 * With `walks`, an ancestor of <PROJECT> (~/work, ~) also counts: a recursive tool would enter every -bare repo.
 */
function violates(raw: string, base: string, roots: { root: string; tasks: string }, walks = false): string | undefined {
	if (!raw || raw.includes("://")) return undefined;
	// A glob walks everything below its literal prefix: `~/work/**` is `~/work`.
	const literal = raw.replace(/\/?[^/]*[*?[{].*$/, "") || (raw.startsWith("/") ? "/" : "");
	if (!literal) return undefined;
	const expanded = expand(literal);
	const abs = isAbsolute(expanded) ? resolve(expanded) : resolve(base, expanded);
	if (walks && within(roots.root, abs)) return abs;
	if (!within(abs, roots.root)) return undefined;
	if (within(abs, roots.tasks)) return undefined;
	return abs;
}

/** Drops a read selector suffix such as `:50-80`, `:raw`, or `:conflicts`. */
function stripSelector(p: string): string {
	return p.replace(/(?::(?:\d[\d,\-+]*|raw|conflicts|img))+$/, "");
}

function tokenize(segment: string): string[] {
	const out: string[] = [];
	const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s"']+)/g;
	for (let m = re.exec(segment); m; m = re.exec(segment)) out.push(m[1] ?? m[2] ?? m[3]);
	return out;
}

function candidateFrom(token: string): string | undefined {
	let t = token.replace(/^\d*[<>]+/, "");
	const eq = t.indexOf("=");
	if (eq > 0 && /^-{0,2}[A-Za-z_][\w-]*=/.test(t)) t = t.slice(eq + 1);
	if (!t) return undefined;
	return /^(~|\$\{?HOME\}?|\/|\.)/.test(t) || t.includes("/") ? t : undefined;
}

export function checkBash(command: string, cwd: string, roots: { root: string; tasks: string }, depth = 0): string | undefined {
	if (depth < 3) {
		for (const m of command.matchAll(/\b(?:ba|z|da|k)?sh\s+-[a-z]*c\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/g)) {
			const bad = checkBash(m[1] ?? m[2], cwd, roots, depth + 1);
			if (bad) return bad;
		}
	}
	let vcwd = resolve(cwd);
	for (const segment of command.split(SEGMENT_SPLIT)) {
		const tokens = tokenize(segment);
		if (tokens[0] === "cd") {
			const target = tokens.find((t, i) => i > 0 && !t.startsWith("-"));
			const dest = target === undefined ? homedir() : expand(target);
			const abs = isAbsolute(dest) ? resolve(dest) : resolve(vcwd, dest);
			const bad = violates(abs, vcwd, roots);
			if (bad) return bad;
			vcwd = abs;
			continue;
		}
		const walks =
			RECURSIVE_BIN[tokens[0]?.split("/").pop() ?? ""] ||
			(["grep", "ls"].includes(tokens[0]) && tokens.some(t => /^-[A-Za-z]*[rR]/.test(t) || t === "--recursive"));
		for (const token of tokens) {
			const cand = candidateFrom(token);
			if (!cand) continue;
			const bad = violates(cand, vcwd, roots, walks);
			if (bad) return bad;
		}
	}
	return undefined;
}

function* pathsOf(toolName: string, value: unknown, key = ""): Generator<string> {
	if (typeof value === "string") {
		if (PATH_KEY.test(key)) for (const piece of value.split(";")) yield stripSelector(piece.trim());
		// edit: `[path#TAG]` section headers inside the `input` payload.
		else if (toolName === "edit" && key === "input") {
			for (const m of value.matchAll(/^\[([^\]#\n]+)(?:#[0-9A-Fa-f]+)?\]/gm)) yield m[1];
		}
	} else if (Array.isArray(value)) {
		for (const v of value) yield* pathsOf(toolName, v, key);
	} else if (value && typeof value === "object") {
		for (const [k, v] of Object.entries(value)) yield* pathsOf(toolName, v, PATH_KEY.test(key) ? key : k);
	}
}

export default function noParentFolderGuard(pi: ExtensionAPI): void {
	pi.setLabel("No parent folder guard");

	pi.on("tool_call", async (event, ctx) => {
		const roots = rootsFor(ctx.cwd);
		if (!roots || event.toolName.startsWith("mcp__")) return;
		const input = event.input as Record<string, unknown>;
		let bad: string | undefined;
		let base = ctx.cwd;
		if (typeof input.cwd === "string") {
			const c = violates(input.cwd, ctx.cwd, roots);
			if (c) bad = c;
			else base = resolve(ctx.cwd, expand(input.cwd));
		}
		if (!bad && event.toolName === "bash" && typeof input.command === "string") bad = checkBash(input.command, base, roots);
		else if (!bad) {
			const walks = !NON_WALKING_TOOLS[event.toolName];
			for (const p of pathsOf(event.toolName, input)) {
				bad = violates(p, ctx.cwd, roots, walks);
				if (bad) break;
			}
		}
		if (bad) return { block: true, reason: `Blocked: ${bad} is outside the tasks folder. ${BLOCK_HINT}` };
	});
}

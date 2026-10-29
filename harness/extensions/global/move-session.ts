/**
 * move-session.ts
 *
 * Registers the `move_session` tool so the agent can move the session working
 * directory to the launch directory or one of its direct children, without
 * stopping to ask the user to type `/move`.
 *
 * Mechanism: `/move` in the TUI runs `CommandController.handleMoveCommand`,
 * which calls `AgentSession.moveSession()` and then
 * `InteractiveMode.applyCwdChange()`. The first is public and typed
 * (`dist/types/session/agent-session.d.ts:677`); the second is not reachable
 * from an extension. Of the ten steps in `applyCwdChange`, this file performs
 * the five that matter — `setProjectDir`, `settings.reloadForCwd`,
 * `resetCapabilities()` (run inside `refreshSkills()`), skill re-discovery
 * plus system-prompt rebuild (also `refreshSkills()`), and the terminal title
 * (`ctx.ui.setTitle`, matching the `π: <label>` format
 * `formatSessionTerminalTitle` uses).
 * `setTitle` maps to `setExtensionTerminalTitle`
 * (`dist/types/utils/title-generator.d.ts:29-35`), which is verbatim and
 * sticky: it freezes the run-state separator (working/idle/attention) and
 * blocks periodic refreshes until the app calls `setSessionTerminalTitle`
 * again on an authoritative rename, new session, or focus swap. That
 * function is the one the app itself uses for cwd-driven titles, but it is
 * not exported from the package root, `sdk.d.ts`, or any extension surface
 * — `ctx.ui.setTitle` is the only reachable path, so the state indicator
 * freeze is an accepted tradeoff, not an oversight. It clears on the next
 * authoritative title set, which `title.ts` triggers via `pi.setSessionName`
 * (lines 167 and 207). `setProjectDir` comes from `@oh-my-pi/pi-utils`; an
 * extension import of that package resolves to the host's own module instance
 * (probed: `logger` is identical to `pi.pi.logger`). The status line path
 * segment reads `getProjectDir()` on every render and re-resolves its cache
 * when it changes, so this call is what makes the footer show the new folder.
 * The git watcher, project slash commands, plugin-root cache, and provider
 * globals stay scoped to the old directory; the result text says so.
 *
 * Unlike `end-session.ts` and `clear-context.ts`, this runs inline in
 * `execute()` rather than deferring to a turn boundary. `moveSession` has no
 * `isStreaming` guard, and `SessionManager.moveTo` serialises concurrent
 * session-file appends itself. Deferring would leave the session on a new cwd
 * with stale skills for the rest of the turn.
 *
 * Live session state is reached only through `pi.pi`. A bare import of
 * `AgentRegistry` from the package root loads a second copy of the module
 * graph with its own empty static registry (see `advisor-drain.ts`).
 *
 * Return to root: `returnToRoot()` (exported) moves the main session back to
 * `state.root` and returns a result object with the reason when it does not
 * move. It runs after `clear_context` (from `clear-context.ts`), at the
 * first `turn_start` after a user `/clear` (`/clear` emits no extension event;
 * the new `reset_boundary` entry is the only trace), and after a manual
 * compaction (`/compact` or `compact_context`). It never runs for harness
 * auto-compaction: `auto_compaction_start`/`_end` bracket those, and a
 * `session_compact` outside that window is manual. `state.root` is stored in
 * the session file, so it survives a restart or resume of the same session.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentSession, ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { setProjectDir } from "@oh-my-pi/pi-utils";

// ─── Move root ─────────────────────────────────────────────────────────────
// `root` is the directory the session started in. From any cwd, the agent may
// move to `root` or to a direct child of it. Every other target is refused:
// there is no prompt. Only the user changes the root, with `/move` or `!cd`.
//
// The launch directory seeds the root. It is read once, when this module
// loads, and never from a session event. `process.cwd()` is not the launch
// directory: `setProjectDir` chdirs the process after every move, and
// `omp --resume` chdirs into the resumed session's folder before extensions
// load (probed 2026-10-12). The shell's `$PWD` is not touched by a chdir, so
// it still names the launch directory. `--cwd` is the one launch flag that
// moves the start on purpose, so with `--cwd` the process cwd is the root.
// State lives on `globalThis` so an extension reload keeps the same root.
//
// The root is also stored in the session file as a `move-session-root` custom
// entry. A restart (`/restart`) or `omp --resume` runs in a new process, and
// the launch folder there is the session folder. On the first main-session
// sync in a new process, the stored root replaces the launch-folder root.
// So a session resumed from inside a task folder still returns to the folder
// where it started.
interface MoveState {
 root: string | undefined;
 currentCwd: string | undefined;
 /** Reset boundaries seen so far. Absent on state created by an older load. */
 resetCount?: number;
 /** True between `auto_compaction_start` and `auto_compaction_end`. */
 autoCompacting?: boolean;
 /** Epoch ms until which a `session_compact` still counts as automatic. */
 autoGraceUntil?: number;
 /**
  * True until the first main-session sync in this process restores the root
  * from the session file. State made by an older extension load on
  * `globalThis` has no field, so it reads as `undefined` and restores nothing.
  * That is correct: the same process still knows its launch folder.
  */
 restorePending?: boolean;
}
const AUTO_COMPACTION_GRACE_MS = 3_000;
const COMPACT_RETURN_POLL_MS = 150;
const COMPACT_RETURN_DEADLINE_MS = 30_000;
const STATE_KEY = Symbol.for("agent.move-session.state");
const ROOT_ENTRY_TYPE = "move-session-root";
function launchCwd(): string | undefined {
 const shellPwd = process.env.PWD;
 const hasCwdFlag = process.argv.some(arg => arg === "--cwd" || arg.startsWith("--cwd="));
 if (!hasCwdFlag && shellPwd && path.isAbsolute(shellPwd)) return path.resolve(shellPwd);
 try {
  return process.cwd();
 } catch {
  return undefined;
 }
}
const state = ((globalThis as Record<symbol, unknown>)[STATE_KEY] ??= {
 root: launchCwd(),
 currentCwd: undefined,
 restorePending: true,
}) as MoveState;

/** The live main-session object, or undefined when this ctx is not it. */
function liveMoveTarget(pi: ExtensionAPI, ctx: ExtensionContext): AgentSession | undefined {
 const ref = pi.pi.AgentRegistry.global().get(pi.pi.MAIN_AGENT_ID);
 const session = ref?.session;
 if (!session) return undefined;
 // Compare session-file ids, not `session.sessionId`. After `/clear` or
 // `clear_context` that getter returns a rotated provider session id, which
 // never equals the session-file id. The check still stops a subagent
 // session from moving the main session's working directory.
 if (session.sessionManager.getSessionId() !== ctx.sessionManager.getSessionId()) return undefined;
 // Feature-detect: a harness upgrade that drops either method degrades to a
 // refusal instead of throwing.
 if (typeof session.moveSession !== "function") return undefined;
 if (typeof session.refreshSkills !== "function") return undefined;
 return session;
}

/** Newest root stored in this session file, or undefined. */
function persistedRoot(ctx: ExtensionContext): string | undefined {
 const entries = ctx.sessionManager.getEntries();
 for (let i = entries.length - 1; i >= 0; i--) {
  const entry = entries[i];
  if (entry.type !== "custom" || entry.customType !== ROOT_ENTRY_TYPE) continue;
  const root = (entry.data as { root?: unknown } | undefined)?.root;
  return typeof root === "string" && path.isAbsolute(root) ? root : undefined;
 }
 return undefined;
}

async function syncCwd(pi: ExtensionAPI, ctx: ExtensionContext, boundary: "turn" | "session"): Promise<void> {
 if (!liveMoveTarget(pi, ctx)) return;
 const cwd = ctx.sessionManager.getCwd();
 const stored = persistedRoot(ctx);
 if (state.restorePending) {
  state.restorePending = false;
  if (stored !== undefined && stored !== state.root) {
   try {
    if ((await fs.stat(stored)).isDirectory()) state.root = stored;
   } catch {
    // A deleted root folder keeps the launch-folder root.
   }
  }
 }
 // At a turn boundary, a cwd this tool did not set is a user `/move` or `!cd`:
 // that is the only way the root changes. A session start or switch (`/clear`,
 // resume) only records the cwd; the root survives it.
 if (boundary === "turn" && state.currentCwd !== undefined && cwd !== state.currentCwd) {
  state.root = cwd;
 }
 state.currentCwd = cwd;
 if (state.root !== undefined && state.root !== stored) pi.appendEntry(ROOT_ENTRY_TYPE, { root: state.root });

 // `/clear` emits no extension event, so a new reset boundary seen at the next
 // turn is the only trace of it. `/clear` and `clear_context` each append one.
 // This runs after the root check above: a `/move` made before the `/clear`
 // already updated the root. A `clear_context` reset has returned to the root
 // already, so this is a no-op for it.
 const resets = ctx.sessionManager.getEntries().filter(entry => entry.type === "reset_boundary").length;
 const cleared = boundary === "turn" && state.resetCount !== undefined && resets > state.resetCount;
 state.resetCount = resets;
 if (cleared) await returnToRoot(pi, ctx);
}

/** Run the move steps shared by the `move_session` tool and `returnToRoot`. */
async function applyMove(pi: ExtensionAPI, ctx: ExtensionContext, live: AgentSession, resolved: string): Promise<void> {
 // Matches both existing move paths, which flush settings before moving.
 await pi.pi.settings.flush();
 await live.moveSession(resolved);
 state.currentCwd = ctx.sessionManager.getCwd();
 // First step of `InteractiveMode.applyCwdChange`. The status line path
 // segment reads this value, so it shows the new folder after this call.
 setProjectDir(resolved);

 // The reachable part of `InteractiveMode.applyCwdChange`. `refreshSkills`
 // also runs `resetCapabilities()` and rebuilds the base system prompt.
 await pi.pi.settings.reloadForCwd(resolved);
 await live.refreshSkills();

 if (!ctx.hasUI) return;
 ctx.ui.notify(`Session moved to ${resolved}`, "info");
 // Verbatim and sticky: this freezes the working/idle/attention title
 // separator until the app sets an authoritative title again (rename,
 // new session, focus swap, or `/title`). See the header comment for
 // why this is the only reachable title API from an extension.
 ctx.ui.setTitle(`π: ${live.sessionName ?? path.basename(resolved)}`);
}

/** Result of `returnToRoot`. A `moved: false` result carries the reason. */
export type ReturnToRootResult =
 | { moved: true; from: string; to: string }
 | {
  moved: false;
  reason: "not-main-session" | "root-unknown" | "already-at-root" | "root-missing" | "move-failed";
  root?: string;
  error?: string;
 };

/**
 * Move the main session back to the root. Returns `{ moved: true, from, to }`
 * on success. Otherwise returns `{ moved: false, reason }`: not the main
 * session, root unknown, already at the root, root missing, or the move failed.
 * A failed move is logged and never thrown.
 */
export async function returnToRoot(pi: ExtensionAPI, ctx: ExtensionContext): Promise<ReturnToRootResult> {
 const live = liveMoveTarget(pi, ctx);
 if (!live) return { moved: false, reason: "not-main-session" };
 const root = state.root;
 if (root === undefined) return { moved: false, reason: "root-unknown" };
 const from = ctx.sessionManager.getCwd();
 if (from === root) return { moved: false, reason: "already-at-root", root };
 try {
  if (!(await fs.stat(root)).isDirectory()) return { moved: false, reason: "root-missing", root };
 } catch {
  return { moved: false, reason: "root-missing", root };
 }
 try {
  await applyMove(pi, ctx, live, root);
  return { moved: true, from, to: root };
 } catch (error) {
  pi.logger.error(`move-session: return to root failed: ${error}`);
  return { moved: false, reason: "move-failed", root, error: String(error) };
 }
}

/**
 * After a manual compaction, wait for the session to settle, return to the root,
 * and queue a hidden note so the agent knows which folder it left. The move runs
 * from a timer, not inside the `session_compact` handler, so it never overlaps
 * the compaction commit.
 */
function scheduleCompactReturn(pi: ExtensionAPI, ctx: ExtensionContext, deadline: number): void {
 ctx.setTimeout(async () => {
  try {
   const live = liveMoveTarget(pi, ctx);
   if (!live) return;
   if (live.isStreaming && Date.now() < deadline) {
    scheduleCompactReturn(pi, ctx, deadline);
    return;
   }
   const result = await returnToRoot(pi, ctx);
   if (!result.moved) return;
   pi.sendMessage(
    {
     customType: "session-moved-to-root",
     content: `Session moved to root ${state.root} after compaction. Previous cwd: ${result.from}.`,
     display: false,
    },
    { triggerTurn: false, deliverAs: "nextTurn" },
   );
  } catch (error) {
   pi.logger.error(`move-session: return after compaction failed: ${error}`);
  }
 }, COMPACT_RETURN_POLL_MS);
}

/** Exactly one level down from `cwd`, and not `cwd` itself. A sibling, an
 *  ancestor, and a grandchild all fail: none has `cwd` as its parent. */
function isDirectChild(resolved: string, cwd: string): boolean {
 return resolved !== cwd && path.dirname(resolved) === cwd;
}

function resolveTarget(raw: string, cwd: string): string {
 const trimmed = raw.trim();
 const expanded =
  trimmed === "~" ? os.homedir() : trimmed.startsWith("~/") ? path.join(os.homedir(), trimmed.slice(2)) : trimmed;
 return path.resolve(cwd, expanded);
}

export default function moveSession(pi: ExtensionAPI) {
 const z = pi.zod;

 pi.on("session_start", async (_event, ctx) => syncCwd(pi, ctx, "session"));
 pi.on("session_switch", async (_event, ctx) => syncCwd(pi, ctx, "session"));
 pi.on("turn_start", async (_event, ctx) => syncCwd(pi, ctx, "turn"));

 // ─── Automatic compaction guard ────────────────────────────────────────
 // Only a compaction the user or the agent asks for returns to the root. The
 // harness fires `auto_compaction_start` / `auto_compaction_end` around every
 // automatic run (threshold, overflow, idle, incomplete) and emits
 // `session_compact` inside that window, so a `session_compact` with no auto
 // run in flight is manual. A mid-turn auto run emits `session_compact` and
 // `auto_compaction_end` detached, so the end event can land first: the grace
 // period keeps a late `session_compact` from counting as manual.
 pi.on("auto_compaction_start", async (_event, ctx) => {
  if (liveMoveTarget(pi, ctx)) state.autoCompacting = true;
 });
 pi.on("auto_compaction_end", async (_event, ctx) => {
  if (!liveMoveTarget(pi, ctx)) return;
  state.autoCompacting = false;
  state.autoGraceUntil = Date.now() + AUTO_COMPACTION_GRACE_MS;
 });
 pi.on("session_compact", async (_event, ctx) => {
  // Decide before any await: no auto run in flight, and none just ended.
  if (state.autoCompacting === true || Date.now() < (state.autoGraceUntil ?? 0)) return;
  if (!liveMoveTarget(pi, ctx)) return;
  scheduleCompactReturn(pi, ctx, Date.now() + COMPACT_RETURN_DEADLINE_MS);
 });

 pi.registerTool({
  name: "move_session",
  label: "Move session",
  description:
   "Move this session's working directory. You may move only to the directory " +
   "`omp` was launched in, or to a direct subdirectory of it. Any other target " +
   "(a parent, a deeper subdirectory such as a repo inside a task folder) is " +
   "refused, with no approval prompt. Use this after creating a working folder " +
   "so language-server and debugger config inside it is picked up, and so " +
   "relative paths resolve against it.",
  parameters: z.object({
   path: z
    .string()
    .describe(
     "Directory to move the session into: the launch directory or one of its " +
     "direct subdirectories. Anything else is refused.",
    ),
  }),
  loadMode: "essential",
  // The rule is enforced in `execute()`, which refuses. `policy: "allow"` is
  // explicit so the harness never prompts: `resolveApproval` honours an
  // explicit tool policy in every mode including the default `yolo`.
  approval: () => ({ tier: "write" as const, policy: "allow" as const }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
   if (!ctx.hasUI) {
    return {
     content: [
      {
       type: "text",
       text:
        "move_session works only in an interactive session. Tell the user to move the " +
        "session themselves with /move.",
      },
     ],
     details: { moved: false, refused: "no-ui" },
     isError: true,
    };
   }

   const live = liveMoveTarget(pi, ctx);
   if (!live) {
    return {
     content: [
      {
       type: "text",
       text:
        "move_session can only move the main session, and only on a harness that exposes " +
        "the move. Do not retry; report this to the user.",
      },
     ],
     details: { moved: false, refused: "no-main-session" },
     isError: true,
    };
   }

   const cwd = ctx.sessionManager.getCwd();
   const resolved = resolveTarget(params.path, cwd);

   if (resolved === cwd) {
    return {
     content: [{ type: "text", text: `Already in ${resolved}.` }],
     details: { moved: false, refused: "same-directory" },
     isError: true,
    };
   }

   if (state.root === undefined) {
    return {
     content: [
      {
       type: "text",
       text: "Refused: the launch directory is unknown. Do not retry; ask the user to run /move.",
      },
     ],
     details: { moved: false, refused: "root-unknown" },
     isError: true,
    };
   }
   if (resolved !== state.root && !isDirectChild(resolved, state.root)) {
    return {
     content: [
      {
       type: "text",
       text:
        `Refused: move_session reaches only ${state.root} or a direct subdirectory of it. ` +
        `${resolved} is neither. Do not retry. Use explicit paths or \`git -C\` from the current ` +
        "directory, or ask the user to run /move.",
      },
     ],
     details: { moved: false, refused: "outside-root", root: state.root },
     isError: true,
    };
   }

   // Never create the directory. The TUI `/move` offers to create a missing
   // one because a human confirms it; an agent conjuring directories is a
   // different action from moving into one the workflow already made.
   let isDirectory = false;
   try {
    isDirectory = (await fs.stat(resolved)).isDirectory();
   } catch {
    isDirectory = false;
   }
   if (!isDirectory) {
    return {
     content: [{ type: "text", text: `Not an existing directory: ${resolved}` }],
     details: { moved: false, refused: "missing-directory" },
     isError: true,
    };
   }

   await applyMove(pi, ctx, live, resolved);

   return {
    content: [
     {
      type: "text",
      text:
       `Moved session to ${resolved}. Relative paths, lsp config, skills, and settings now ` +
       `resolve against this directory, and the terminal title and status line path now ` +
       `show it too. The status line git segment, project slash commands, and MCP servers ` +
       `are unchanged — that is expected, not a failed move.`,
     },
    ],
    details: { moved: true, from: cwd, to: resolved },
   };
  },
 });
}

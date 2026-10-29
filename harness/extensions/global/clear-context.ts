/**
 * clear-context.ts
 *
 * Registers the `clear_context` tool so the agent can clear its own
 * conversation context when the user asks for it, the same way
 * `end-session.ts` closes the session when the user asks for that.
 *
 * Mechanism: `/clear` in the TUI is a TUI-only slash command
 * (`src/slash-commands/builtin-lifecycle.ts:104`) that calls
 * `InteractiveMode.handleResetContextCommand()`. That path is not reachable
 * from an extension, but the underlying session method is public and typed:
 * `AgentSession.resetSessionContext()` (`dist/types/session/agent-session.d.ts:229`).
 *
 * `resetSessionContext()` returns `undefined` and mutates nothing while
 * `isStreaming`, `isBashRunning`, or `isEvalRunning` is true
 * (`src/session/agent-session.ts:4206-4213`). A tool `execute()` always runs
 * inside a streaming turn, so the reset cannot run inline. It is deferred to
 * an idle poll started from `agent_end`, not run in the handler itself.
 * Extension handlers have a 30s host ceiling
 * (`EXTENSION_HANDLER_TIMEOUT_MS`, documented in `advisor-drain.ts`);
 * `ctx.setTimeout` callbacks are not handlers and have no such ceiling.
 *
 * The reset drops messages only. `sessionManager.appendResetBoundary()`
 * keeps the full history on disk (`src/session/agent-session.ts:4277`), so
 * the session id, title, transcript file, model, and settings all survive.
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { drainAdvisors, liveMainSession } from "./advisor-drain";
import { returnToRoot } from "./move-session";

const DRAIN_TIMEOUT_MS = 45_000;
const IDLE_POLL_MS = 150;
const IDLE_DEADLINE_MS = 30_000;

// Session id armed for a context reset at the next terminal `agent_end`, set
// by `execute()` below. `undefined` means no reset is pending. One process
// ever hosts one main session at a time, so a bare module variable (not a
// per-session map) is enough.
let armedSessionId: string | undefined;

/**
 * Make the TUI match the emptied context, like `/clear` does.
 *
 * `/clear` calls `InteractiveMode.resetTranscript()` and
 * `requestRender(true, { clearScrollback: true })`
 * (`src/modes/controllers/command-controller.ts:979-992`). Neither is exposed
 * to extensions, so two public paths stand in for them:
 *
 * 1. A displayed custom message makes the host call `rebuildChatFromMessages()`
 *    (`extension-ui-controller.ts:1201-1211`). The rebuild replays only the
 *    entries after the reset boundary, so the chat holds this one message.
 * 2. A widget factory receives the live `TUI`. A forced repaint with
 *    `clearScrollback` removes the old rows from native scrollback.
 */
function clearScreen(pi: ExtensionAPI, ctx: ExtensionContext, droppedCount: number): void {
 const widgetKey = "clear-context-repaint";
 pi.sendMessage(
  {
   customType: "context-cleared",
   content: `Context cleared: ${droppedCount} messages dropped. Session continues.`,
   display: true,
  },
  { triggerTurn: false },
 );
 // Wait for the rebuild to commit before the forced repaint.
 ctx.setTimeout(() => {
  ctx.ui.setWidget(widgetKey, tui => {
   ctx.setTimeout(() => {
    tui.requestRender(true, { clearScrollback: true });
    ctx.ui.setWidget(widgetKey, undefined);
   }, 0);
   return { render: () => [], invalidate: () => { } };
  });
 }, IDLE_POLL_MS);
}

/**
 * Poll until the live main session is idle, then reset its context. Reschedules
 * itself on `ctx.setTimeout` while busy, up to `deadline`. Stops silently when
 * the session disappears or the harness drops `resetSessionContext`.
 */
function scheduleReset(pi: ExtensionAPI, ctx: ExtensionContext, deadline: number): void {
 ctx.setTimeout(async () => {
  try {
   const live = liveMainSession(pi, ctx);
   if (!live || typeof live.resetSessionContext !== "function") return;

   if (live.isStreaming || live.isBashRunning || live.isEvalRunning) {
    if (Date.now() < deadline) {
     scheduleReset(pi, ctx, deadline);
     return;
    }
    ctx.ui.notify("Context clear cancelled: the session stayed busy.", "warning");
    return;
   }

   if (ctx.hasPendingMessages()) {
    // Cancelling beats clearing here: the queued turn keeps its history.
    ctx.ui.notify("Context clear cancelled: a queued message is waiting.", "warning");
    return;
   }

   // Let an in-flight WikiScribe vault write finish before its context
   // drops. `resetSessionContext()` itself calls
   // `#advisors.resetSessionState()`, which does not wait for that write.
   await drainAdvisors(pi, ctx, DRAIN_TIMEOUT_MS);

   const result = await live.resetSessionContext();
   if (result === undefined) {
    ctx.ui.notify("Context clear failed: the session was not idle.", "warning");
    return;
   }
   // A cleared session starts fresh in the root. A failed move gives a
   // warning with the reason and does not undo the clear.
   const moved = await returnToRoot(pi, ctx);
   const base = `Context cleared: ${result.droppedCount} messages dropped. Session continues.`;
   if (!moved.moved && moved.reason !== "already-at-root") {
    const detail = moved.error ? `: ${moved.error}` : "";
    ctx.ui.notify(`${base} The session did not return to the launch folder (${moved.reason}${detail}).`, "warning");
   } else {
    ctx.ui.notify(base, "info");
   }
   clearScreen(pi, ctx, result.droppedCount);
  } catch (error) {
   pi.logger.error(`clear-context: reset failed: ${error}`);
  }
 }, IDLE_POLL_MS);
}

export default function clearContext(pi: ExtensionAPI) {
 const z = pi.zod;

 // The actual reset driver. Fires on every agent loop's end; only acts when
 // `execute()` below armed this exact session id, so unrelated turns
 // (including subagents') are unaffected.
 pi.on("agent_end", async (event, ctx) => {
  if (armedSessionId === undefined || ctx.sessionManager.getSessionId() !== armedSessionId) return;
  // A scheduled continuation means this is not the settle point. Stay
  // armed for the terminal `agent_end`.
  if (event.willContinue === true) return;
  armedSessionId = undefined;
  scheduleReset(pi, ctx, Date.now() + IDLE_DEADLINE_MS);
 });

 pi.registerTool({
  name: "clear_context",
  label: "Clear Context",
  description:
   "Clear this session's conversation context in place. Same effect as the user typing " +
   "/clear: every message drops from the model's context, the on-screen transcript and " +
   "scrollback clear, and the session id, title, transcript file, model, and settings all stay. " +
   "Call this only when the user asks in plain words to clear " +
   "the context, reset the context, or start fresh in this session. Never call it on your " +
   "own initiative, never to escape a hard task or a long conversation, and never while " +
   "work the user asked for is unfinished.",
  parameters: z.object({
   reason: z.string(),
  }),
  loadMode: "essential",
  approval: "read",
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
   if (!ctx.hasUI) {
    return {
     content: [
      {
       type: "text",
       text: "clear_context works only in an interactive session. Tell the user to clear the context themselves.",
      },
     ],
     details: { clearing: false, reason: params.reason, refused: "no-ui" },
     isError: true,
    };
   }

   if (ctx.hasPendingMessages()) {
    return {
     content: [
      {
       type: "text",
       text:
        "Queued messages are still pending. Context clear is cancelled. Report the " +
        "queued work to the user and ask which to run first.",
      },
     ],
     details: { clearing: false, reason: params.reason, refused: "pending-messages" },
     isError: true,
    };
   }

   armedSessionId = ctx.sessionManager.getSessionId();
   ctx.ui.notify(`Clearing context: ${params.reason}`, "info");

   return {
    content: [
     {
      type: "text",
      text:
       "Context clear is scheduled. The conversation context drops when this turn " +
       "settles. Write one short line to confirm, then stop. Do not start new work in " +
       "this turn.",
     },
    ],
    details: { clearing: true, reason: params.reason },
   };
  },
 });
}

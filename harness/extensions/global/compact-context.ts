/**
 * compact-context.ts
 *
 * Registers the `compact_context` tool so the agent can compact its own
 * conversation context when the user asks for it, the same way
 * `clear-context.ts` clears it.
 *
 * Mechanism: `/compact` in the TUI ends in the public, typed
 * `AgentSession.compact()` (`dist/types/session/agent-session.d.ts:389`). A tool
 * `execute()` always runs inside a streaming turn, so the compaction is deferred
 * to an idle poll started from `agent_end`, exactly like `clear-context.ts`.
 *
 * This file does not move the session. `compact()` is the manual path: it emits
 * `session_compact` with no `auto_compaction_start` in flight. The hook in
 * `move-session.ts` sees that, returns to the root, and queues the note for the
 * agent. Moving here as well would run the move and the note twice. If
 * `compact()` is cancelled or finds nothing to compact, no `session_compact`
 * fires and the session stays where it is.
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { drainAdvisors, liveMainSession } from "./advisor-drain";

const DRAIN_TIMEOUT_MS = 45_000;
const IDLE_POLL_MS = 150;
const IDLE_DEADLINE_MS = 30_000;

// Session id armed for a compaction at the next terminal `agent_end`, set by
// `execute()` below. `undefined` means none is pending.
let armedSessionId: string | undefined;

/**
 * Poll until the live main session is idle, then compact it. Reschedules itself
 * on `ctx.setTimeout` while busy, up to `deadline`. Stops silently when the
 * session disappears or the harness drops `compact`.
 */
function scheduleCompact(pi: ExtensionAPI, ctx: ExtensionContext, deadline: number): void {
  ctx.setTimeout(async () => {
    try {
      const live = liveMainSession(pi, ctx);
      if (!live || typeof live.compact !== "function") return;

      if (live.isStreaming || live.isBashRunning || live.isEvalRunning) {
        if (Date.now() < deadline) {
          scheduleCompact(pi, ctx, deadline);
          return;
        }
        ctx.ui.notify("Context compaction cancelled: the session stayed busy.", "warning");
        return;
      }

      if (ctx.hasPendingMessages()) {
        ctx.ui.notify("Context compaction cancelled: a queued message is waiting.", "warning");
        return;
      }

      // Compaction resets advisor runtimes. Let an in-flight WikiScribe vault
      // write finish first.
      await drainAdvisors(pi, ctx, DRAIN_TIMEOUT_MS);

      await live.compact();
      ctx.ui.notify("Context compacted. Session continues.", "info");
    } catch (error) {
      pi.logger.error(`compact-context: compaction failed: ${error}`);
      ctx.ui.notify(`Context compaction failed: ${error}`, "warning");
    }
  }, IDLE_POLL_MS);
}

export default function compactContext(pi: ExtensionAPI) {
  const z = pi.zod;

  // Fires on every agent loop's end; only acts when `execute()` below armed
  // this exact session id, so unrelated turns (including subagents') are
  // unaffected.
  pi.on("agent_end", async (event, ctx) => {
    if (armedSessionId === undefined || ctx.sessionManager.getSessionId() !== armedSessionId) return;
    // A scheduled continuation means this is not the settle point. Stay armed.
    if (event.willContinue === true) return;
    armedSessionId = undefined;
    scheduleCompact(pi, ctx, Date.now() + IDLE_DEADLINE_MS);
  });

  pi.registerTool({
    name: "compact_context",
    label: "Compact Context",
    description:
      "Compact this session's conversation context in place. Same effect as the user typing " +
      "/compact: older messages become a summary, and the session id, title, transcript file, " +
      "model, and settings all stay. The session then returns to its launch directory, and you " +
      "get a note naming the folder you left. Call this only when the user asks in plain words " +
      "to compact the context. Never call it on your own initiative, and never while work the " +
      "user asked for is unfinished.",
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
              text: "compact_context works only in an interactive session. Tell the user to compact the context themselves.",
            },
          ],
          details: { compacting: false, reason: params.reason, refused: "no-ui" },
          isError: true,
        };
      }

      if (ctx.hasPendingMessages()) {
        return {
          content: [
            {
              type: "text",
              text:
                "Queued messages are still pending. Context compaction is cancelled. Report the " +
                "queued work to the user and ask which to run first.",
            },
          ],
          details: { compacting: false, reason: params.reason, refused: "pending-messages" },
          isError: true,
        };
      }

      armedSessionId = ctx.sessionManager.getSessionId();
      ctx.ui.notify(`Compacting context: ${params.reason}`, "info");

      return {
        content: [
          {
            type: "text",
            text:
              "Context compaction is scheduled. It runs when this turn settles, then the session " +
              "returns to its launch directory. Write one short line to confirm, then stop. Do " +
              "not start new work in this turn.",
          },
        ],
        details: { compacting: true, reason: params.reason },
      };
    },
  });
}

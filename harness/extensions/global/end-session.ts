/**
 * end-session.ts
 *
 * Registers the `end_session` tool so the agent can close the session when
 * the user asks for it, instead of telling the user to type `/exit`.
 *
 * Mechanism: `/exit` in the TUI calls the controller's `shutdown()`, which
 * sets `shutdownRequested` for `checkShutdownRequested()` to act on once the
 * current submission settles. This tool still calls `ctx.shutdown()` for
 * forward compatibility, but does not rely on it alone. Live evidence from
 * this session's own PID-tagged log (`~/.omp/logs/omp.<date>.<pid>.log`)
 * showed `ctx.shutdown()` called from a tool `execute()` never actually
 * reached `session.dispose()`/`process.exit()`: the deferred flag was set,
 * but nothing ever acted on it, while ordinary `turn_end` hooks (e.g.
 * `advisor-drain.ts`'s "advisor shutdown drain incomplete" warning) kept
 * firing normally for the rest of the process's life. So the real exit is
 * driven from this file's own `turn_end` hook below, which the same log
 * proves fires reliably every turn. Deferring to `turn_end` (rather than
 * exiting inline in `execute()`) still lets the requesting turn's own final
 * assistant text generate and persist before the process exits.
 *
 * `ctx.shutdown()` is documented as a no-op in subagent and ACP contexts,
 * and an immediate `process.exit(0)` in print mode. Both are wrong or
 * useless for this tool, so the tool refuses to run when `ctx.hasUI` is
 * false — this also gates the `turn_end` exit path below, since it only
 * arms when `execute()` reaches that point.
 *
 * Before scheduling shutdown, this awaits `drainAdvisors` (see
 * `advisor-drain.ts`) so an in-flight vault write finishes before the
 * process exits. `session_shutdown` fires but is not awaited, so this is
 * the one exit path this code controls; `/exit` typed by the user still
 * exits without draining.
 *
 * This call runs inside a tool `execute()`, not a hook handler, so it is
 * not subject to the harness's 30s `EXTENSION_HANDLER_TIMEOUT_MS` ceiling
 * that caps every `turn_end` handler (see `advisor-drain.ts`). It can use
 * a longer cap.
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { drainAdvisors, liveMainSession } from "./advisor-drain";

const DRAIN_TIMEOUT_MS = 45_000;

// Session id armed for a hard exit at the next `turn_end`, set by `execute()`
// below. `undefined` means no close is pending. One process ever hosts one
// main session at a time, so a bare module variable (not a per-session map)
// is enough.
let armedSessionId: string | undefined;

export default function endSession(pi: ExtensionAPI) {
  const z = pi.zod;

  // The actual exit driver — see the file header for why `ctx.shutdown()`
  // alone is not trusted. Fires on every turn's end; only acts when
  // `execute()` below armed this exact session id, so unrelated turns
  // (including subagents') are unaffected.
  pi.on("turn_end", async (_event, ctx) => {
    if (armedSessionId === undefined || ctx.sessionManager.getSessionId() !== armedSessionId) return;
    armedSessionId = undefined;
    const live = liveMainSession(pi, ctx);
    try {
      await live?.dispose();
    } finally {
      process.exit(0);
    }
  });

  pi.registerTool({
    name: "end_session",
    label: "End Session",
    description:
      "Close this omp session. Same effect as the user typing /exit: the session saves, " +
      "the process exits after the current turn ends, and omp prints the resume command. " +
      "Call this only when the user asks in plain words to close, end, quit, or exit the " +
      "session. Never call it on your own initiative, never to escape a hard task, and " +
      "never while work the user asked for is unfinished.",
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
              text:
                "end_session works only in an interactive session. Tell the user to close " +
                "this session themselves.",
            },
          ],
          details: { closing: false, reason: params.reason, refused: "no-ui" },
          isError: true,
        };
      }

      if (ctx.hasPendingMessages()) {
        return {
          content: [
            {
              type: "text",
              text:
                "Queued messages are still pending. Session close is cancelled. Report the " +
                "queued work to the user and ask which to run first.",
            },
          ],
          details: { closing: false, reason: params.reason, refused: "pending-messages" },
          isError: true,
        };
      }

      await drainAdvisors(pi, ctx, DRAIN_TIMEOUT_MS);
      ctx.shutdown();
      armedSessionId = ctx.sessionManager.getSessionId();
      ctx.ui.notify(`Closing session: ${params.reason}`, "info");

      return {
        content: [
          {
            type: "text",
            text:
              "Session close is scheduled. The session exits when this turn ends. Write one " +
              "short closing line, then stop.",
          },
        ],
        details: { closing: true, reason: params.reason },
      };
    },
  });
}

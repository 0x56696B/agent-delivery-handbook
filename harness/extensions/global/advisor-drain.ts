/**
 * advisor-drain.ts
 *
 * Holds a session busy at turn end until every advisor finishes, so an
 * in-flight vault write (or any other advisor side effect) is not lost when
 * the turn ends and the UI, or the process, moves on.
 *
 * `AgentSession.waitForAdvisorCatchup(timeoutMs)` awaits every advisor's
 * backlog down to zero, plus pending advisor-card persistence. It returns
 * `false` on deadline expiry or advisor failure. There is no public
 * per-advisor busy read, so the drain itself still waits on every advisor,
 * not one by name. The working-message text below only picks a name to
 * display; it does not change which advisors the drain waits for.
 *
 * Live-tested cap: the harness enforces its own hard ceiling on every
 * `turn_end` hook handler, `EXTENSION_HANDLER_TIMEOUT_MS` (30s), with no
 * per-event override. A `timeoutMs` at or above that ceiling never runs to
 * completion: the host aborts the handler at 30s and logs "handler timed
 * out", regardless of the value passed here. `HOOK_DRAIN_TIMEOUT_MS` stays
 * a safety margin under that fixed ceiling.
 *
 * `drainAdvisors` is also called from `end-session.ts`, inside a tool
 * `execute()` call, not a hook handler. That path has no 30s host ceiling,
 * so it passes its own, longer cap.
 */

import type { AgentSession, ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { discoverAdvisorConfigs, slugifyAdvisorName } from "./lib/advisor-config-compat";

const HOOK_DRAIN_TIMEOUT_MS = 25_000;
const WIKISCRIBE_SLUG = slugifyAdvisorName("WikiScribe");
const GENERIC_MESSAGE = "Waiting for advisors to finish…";
const WIKISCRIBE_MESSAGE = "Waiting for WikiScribe to finish filing to the vault…";

/**
 * True when the merged `WATCHDOG.yml` roster for this cwd has an enabled
 * `WikiScribe` entry. This reads static config, not live per-advisor busy
 * state (the harness exposes none), so it names the advisor that is
 * configured to run, not necessarily the one currently backlogged.
 */
async function wikiScribeConfigured(pi: ExtensionAPI, ctx: ExtensionContext): Promise<boolean> {
 try {
  const discovered = await discoverAdvisorConfigs(ctx.cwd, pi.pi.getAgentDir());
  return discovered.advisors.some(
   (advisor) => slugifyAdvisorName(advisor.name) === WIKISCRIBE_SLUG && advisor.enabled !== false,
  );
 } catch {
  return false;
 }
}

// ─── Live session access ───────────────────────────────────────────────────
// Reach live session state only through `pi.pi`. A bare import of
// `AgentRegistry` from the package root loads a second copy of the module
// graph with its own static registry, which always reads as empty.
export function liveMainSession(pi: ExtensionAPI, ctx: ExtensionContext): AgentSession | undefined {
 const ref = pi.pi.AgentRegistry.global().get(pi.pi.MAIN_AGENT_ID);
 const session = ref?.session;
 if (!session) return undefined;
 // Compare session-file ids, not `session.sessionId`: after `/clear` or
 // `clear_context` that getter returns a rotated provider id. The check
 // still stops a subagent session from draining on the main session's behalf.
 if (session.sessionManager.getSessionId() !== ctx.sessionManager.getSessionId()) return undefined;
 // Feature-detect: a harness upgrade that drops the method degrades to no
 // drain instead of throwing on every turn.
 if (typeof session.waitForAdvisorCatchup !== "function") return undefined;
 return session;
}

/**
 * Wait for every advisor on the live main session to finish, up to
 * `timeoutMs`. Does nothing when the session is missing, is a subagent
 * session, or the harness does not expose the drain method.
 */
export async function drainAdvisors(pi: ExtensionAPI, ctx: ExtensionContext, timeoutMs: number): Promise<void> {
 const live = liveMainSession(pi, ctx);
 if (!live) return;
 // The harness already logs the abandoned-work warning on `false`. A UI
 // notification on every slow turn would be noise, so this stays silent
 // either way.
 await live.waitForAdvisorCatchup(timeoutMs);
}

export default function advisorDrain(pi: ExtensionAPI): void {
 pi.on("turn_end", async (_event, ctx) => {
  const message = (await wikiScribeConfigured(pi, ctx)) ? WIKISCRIBE_MESSAGE : GENERIC_MESSAGE;
  ctx.ui.setWorkingMessage?.(message);
  try {
   await drainAdvisors(pi, ctx, HOOK_DRAIN_TIMEOUT_MS);
  } finally {
   ctx.ui.setWorkingMessage?.(undefined);
  }
 });
}

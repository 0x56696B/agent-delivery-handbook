/**
 * advisor-gate.ts
 *
 * Activates dormant advisors on demand instead of running every advisor in
 * every session.
 *
 * An advisor entry with `enabled: false` stays in the merged `WATCHDOG.yml`
 * roster and OMP never builds its runtime. This extension flips that flag to
 * `true` for the advisors a skill asks for, then rebuilds the roster in place
 * with `AgentSession.applyAdvisorConfigs`.
 *
 * An advisor is requested in three ways:
 *   - `/skill:<name>` typed by the user (interactive mode only);
 *   - a `read` of `skill://<name>` by the model;
 *   - `/advisors add <name>` typed by the user.
 *
 * A skill declares its advisors in one of two places:
 *   - `advisors:` in its own SKILL.md frontmatter, for a skill you own;
 *   - `advisor-gate.yml`, for a vendored skill whose frontmatter a re-sync
 *     overwrites.
 *
 * Both roster and bindings are project scoped: a `.omp/WATCHDOG.yml` and a
 * `.omp/advisor-gate.yml` are visible only inside their own repository. This
 * file ships at user level so gating works in any repository, and it declares
 * no advisor and no binding of its own. In a project that ships neither file it
 * resolves an empty set and never rebuilds a roster.
 *
 * There is no automatic release. Every `applyAdvisorConfigs` call stops and
 * rebuilds every advisor runtime, so a release on a timer would pay that cost
 * again and could cut a review short.
 */

import * as os from "node:os";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { YAML } from "bun";
import { discoverAdvisorConfigs, slugifyAdvisorName } from "./lib/advisor-config-compat";
import type { AdvisorConfig, DiscoveredAdvisors } from "./lib/advisor-config-compat";
import type {
 AgentSession,
 ExtensionAPI,
 ExtensionCommandContext,
 ExtensionContext,
} from "@oh-my-pi/pi-coding-agent";

// ─── Constants ─────────────────────────────────────────────────────────────
// The bindings file name, probed at the same levels as `WATCHDOG.yml`.
const BINDINGS_FILE = "advisor-gate.yml";

// `/skill:code-review some args` — the interactive skill command.
const SKILL_COMMAND_RE = /^\/skill:([a-zA-Z0-9_-]+)/;

// `skill://code-review` — the path a model-invoked skill reads.
const SKILL_URL_RE = /^skill:\/\/([^/]+)/;

// A leading YAML frontmatter block in a SKILL.md file.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

const USAGE = "Usage: /advisors [list|add <name>|release <name>|reset]";

// ─── Field guards ──────────────────────────────────────────────────────────
// Both files this extension reads are YAML, so every field is `unknown` until a
// guard checks it. Each guard checks one field, at one boundary.
function isStringArray(value: unknown): value is string[] {
 return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function errorCode(err: unknown): string | undefined {
 if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
 return typeof err.code === "string" ? err.code : undefined;
}

// ─── Session state ─────────────────────────────────────────────────────────
// Slugs of the advisors this extension turned on, keyed by session id. Keying
// by session id gives a correct empty set after `/new` with no dependency on a
// lifecycle event. Entries are never evicted: the map holds at most a few small
// sets for the life of one process.
const activeBySession = new Map<string, Set<string>>();

function activeSlugs(sessionId: string): Set<string> {
 let slugs = activeBySession.get(sessionId);
 if (!slugs) {
  slugs = new Set<string>();
  activeBySession.set(sessionId, slugs);
 }
 return slugs;
}

// ─── Live session access ───────────────────────────────────────────────────
// Reach live session state only through `pi.pi`. A bare import of
// `AgentRegistry` from the package root loads a second copy of the module graph
// with its own static registry, which always reads as empty.
function liveMainSession(pi: ExtensionAPI, ctx: ExtensionContext): AgentSession | undefined {
 const ref = pi.pi.AgentRegistry.global().get(pi.pi.MAIN_AGENT_ID);
 const session = ref?.session;
 if (!session) return undefined;
 // Compare session-file ids, not `session.sessionId`: after `/clear` or
 // `clear_context` that getter returns a rotated provider id. The check
 // still stops a subagent session from rewriting the main session's roster.
 if (session.sessionManager.getSessionId() !== ctx.sessionManager.getSessionId()) return undefined;
 // Feature-detect: a harness upgrade that drops the method degrades to no
 // gating instead of throwing on every turn.
 if (typeof session.applyAdvisorConfigs !== "function") return undefined;
 return session;
}

// ─── Bindings ──────────────────────────────────────────────────────────────
// Mirror the roster search path so bindings scope the way advisors do: the user
// agent dir first, then `<dir>/.omp/advisor-gate.yml` for every directory from
// the git repo root down to `cwd`.
function boundaryDir(cwd: string): string {
 const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
  cwd,
  stdout: "pipe",
  stderr: "ignore",
 });
 if (result.exitCode !== 0) return os.homedir();
 return result.stdout.toString().trim() || os.homedir();
}

function bindingCandidates(pi: ExtensionAPI, cwd: string): string[] {
 const candidates: string[] = [];
 const agentDir = pi.pi.getAgentDir();
 // No user-level bindings file ships today. Keeping the candidate costs one
 // failed read and lets a future user-level file work with no code change.
 if (agentDir) candidates.push(path.resolve(agentDir, BINDINGS_FILE));

 const boundary = boundaryDir(cwd);
 const dirs: string[] = [];
 let current = path.resolve(cwd);
 while (true) {
  dirs.push(current);
  if (current === boundary) break;
  const parent = path.dirname(current);
  if (parent === current) break;
  current = parent;
 }
 // Least specific first: the leaf directory wins.
 for (let index = dirs.length - 1; index >= 0; index--) {
  candidates.push(path.join(dirs[index]!, ".omp", BINDINGS_FILE));
 }
 return candidates;
}

function parseSkillsMap(parsed: unknown): Record<string, string[]> | undefined {
 if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
 if (!("skills" in parsed)) return undefined;
 const skills = parsed.skills;
 if (typeof skills !== "object" || skills === null || Array.isArray(skills)) return undefined;
 const bindings: Record<string, string[]> = {};
 for (const [skill, advisors] of Object.entries(skills)) {
  if (!isStringArray(advisors)) return undefined;
  bindings[skill] = advisors;
 }
 return bindings;
}

function readBindings(pi: ExtensionAPI, cwd: string): Record<string, string[]> {
 const merged: Record<string, string[]> = {};
 for (const file of bindingCandidates(pi, cwd)) {
  let text: string;
  try {
   text = readFileSync(file, "utf8");
  } catch (err) {
   // A missing file is the normal case, not an error.
   const code = errorCode(err);
   if (code !== "ENOENT" && code !== "ENOTDIR") {
    pi.logger.warn("advisor-gate: failed to read bindings", { path: file, error: String(err) });
   }
   continue;
  }

  let parsed: unknown;
  try {
   parsed = YAML.parse(text);
  } catch (err) {
   pi.logger.warn("advisor-gate: failed to parse bindings", { path: file, error: String(err) });
   continue;
  }
  // An empty or comment-only file binds nothing.
  if (parsed === null || parsed === undefined) continue;

  const bindings = parseSkillsMap(parsed);
  if (!bindings) {
   pi.logger.warn("advisor-gate: ignoring bindings", {
    path: file,
    reason: "expected a `skills` mapping of skill name to a list of advisor names",
   });
   continue;
  }
  // A more specific file replaces a whole skill key, the way
  // `discoverAdvisorConfigs` replaces a whole advisor entry by slug.
  Object.assign(merged, bindings);
 }
 return merged;
}

// ─── Skill frontmatter ─────────────────────────────────────────────────────
function frontmatterAdvisors(skillFile: string): string[] {
 let text: string;
 try {
  text = readFileSync(skillFile, "utf8");
 } catch {
  return [];
 }
 const match = FRONTMATTER_RE.exec(text);
 if (!match) return [];
 try {
  // The YAML parser accepts both `advisors: [A, B]` and the block form.
  const parsed = YAML.parse(match[1]!);
  if (typeof parsed !== "object" || parsed === null || !("advisors" in parsed)) return [];
  const advisors = parsed.advisors;
  if (!Array.isArray(advisors)) return [];
  return advisors.filter((name): name is string => typeof name === "string");
 } catch {
  return [];
 }
}

async function requestedFor(
 pi: ExtensionAPI,
 ctx: ExtensionContext,
 skillName: string,
 live: AgentSession,
): Promise<string[]> {
 const names = [...(readBindings(pi, ctx.cwd)[skillName] ?? [])];
 try {
  // Covers every discovery root, so no skill path is hardcoded.
  const { skills } = await pi.pi.discoverSkills(ctx.cwd, pi.pi.getAgentDir(), live.skillsSettings);
  const skill = skills.find((entry) => entry.name === skillName);
  if (skill) names.push(...frontmatterAdvisors(skill.filePath));
 } catch (err) {
  pi.logger.warn("advisor-gate: skill discovery failed", { skill: skillName, error: String(err) });
 }

 const seen = new Set<string>();
 const unique: string[] = [];
 for (const name of names) {
  const slug = slugifyAdvisorName(name);
  if (seen.has(slug)) continue;
  seen.add(slug);
  unique.push(name);
 }
 return unique;
}

// ─── Roster rebuild ────────────────────────────────────────────────────────
function rosterBySlug(discovered: DiscoveredAdvisors): Map<string, AdvisorConfig> {
 const bySlug = new Map<string, AdvisorConfig>();
 for (const advisor of discovered.advisors) bySlug.set(slugifyAdvisorName(advisor.name), advisor);
 return bySlug;
}

// Pass every advisor, the dormant ones included, so they stay visible in
// `/advisor status`. Roster order is preserved.
function applyRoster(live: AgentSession, discovered: DiscoveredAdvisors, active: Set<string>): number {
 const roster: AdvisorConfig[] = discovered.advisors.map((advisor) =>
  active.has(slugifyAdvisorName(advisor.name)) ? { ...advisor, enabled: true } : advisor,
 );
 return live.applyAdvisorConfigs(roster, discovered.sharedInstructions);
}

// ─── Activation ────────────────────────────────────────────────────────────
interface ActivationResult {
 /** Advisors this call turned on. */
 activated: string[];
 /** Requested advisors the roster already runs unconditionally. */
 alwaysOn: string[];
 /** Requested advisors this session turned on earlier. */
 already: string[];
 /** Requested names absent from the merged roster. */
 unknown: string[];
 /** False when no live main session was reachable. */
 reachable: boolean;
}

function emptyActivation(reachable: boolean): ActivationResult {
 return { activated: [], alwaysOn: [], already: [], unknown: [], reachable };
}

async function activate(
 pi: ExtensionAPI,
 ctx: ExtensionContext,
 names: string[],
 source: string,
): Promise<ActivationResult> {
 if (names.length === 0) return emptyActivation(true);
 const live = liveMainSession(pi, ctx);
 if (!live) return emptyActivation(false);

 const active = activeSlugs(live.sessionId);
 const discovered = await discoverAdvisorConfigs(ctx.cwd, pi.pi.getAgentDir());
 const bySlug = rosterBySlug(discovered);
 const result = emptyActivation(true);

 for (const name of names) {
  const slug = slugifyAdvisorName(name);
  const advisor = bySlug.get(slug);
  if (!advisor) {
   pi.logger.warn("advisor-gate: advisor is not in the roster", { advisor: name, source });
   result.unknown.push(name);
   continue;
  }
  if (advisor.enabled !== false) {
   result.alwaysOn.push(advisor.name);
   continue;
  }
  if (active.has(slug)) {
   result.already.push(advisor.name);
   continue;
  }
  active.add(slug);
  result.activated.push(advisor.name);
 }

 // A repeated trigger performs no rebuild: `tool_call` can fire more than
 // once for one `read`.
 if (result.activated.length === 0) return result;

 const count = applyRoster(live, discovered, active);
 pi.logger.info("advisor-gate: activated advisors", {
  advisors: result.activated,
  source,
  activeAdvisors: count,
 });
 return result;
}

async function deactivate(pi: ExtensionAPI, ctx: ExtensionContext, names: string[]): Promise<string[]> {
 const live = liveMainSession(pi, ctx);
 if (!live) return [];
 const active = activeSlugs(live.sessionId);
 if (active.size === 0 || names.length === 0) return [];

 const discovered = await discoverAdvisorConfigs(ctx.cwd, pi.pi.getAgentDir());
 const bySlug = rosterBySlug(discovered);
 const released: string[] = [];
 for (const name of names) {
  const slug = slugifyAdvisorName(name);
  if (!active.delete(slug)) continue;
  released.push(bySlug.get(slug)?.name ?? name);
 }
 if (released.length === 0) return [];

 const count = applyRoster(live, discovered, active);
 pi.logger.info("advisor-gate: released advisors", { advisors: released, activeAdvisors: count });
 return released;
}

// ─── Command surface ───────────────────────────────────────────────────────
async function listAdvisors(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
 const live = liveMainSession(pi, ctx);
 const active = live ? activeSlugs(live.sessionId) : new Set<string>();
 const discovered = await discoverAdvisorConfigs(ctx.cwd, pi.pi.getAgentDir());

 const lines: string[] = [];
 let dormant = 0;
 for (const advisor of discovered.advisors) {
  if (advisor.enabled !== false) {
   lines.push(`${advisor.name} — always-on`);
   continue;
  }
  dormant++;
  lines.push(`${advisor.name} — ${active.has(slugifyAdvisorName(advisor.name)) ? "active" : "available"}`);
 }
 if (dormant === 0) lines.push("No on-demand advisor is declared for this project.");
 ctx.ui.notify(lines.join("\n"), "info");
}

async function addAdvisors(pi: ExtensionAPI, ctx: ExtensionCommandContext, names: string[]): Promise<void> {
 const result = await activate(pi, ctx, names, "command");
 if (!result.reachable) {
  ctx.ui.notify("Advisor gating is not available in this session.", "warning");
  return;
 }
 for (const name of result.unknown) {
  ctx.ui.notify(`Advisor "${name}" is not in the roster for this project.`, "warning");
 }
 for (const name of result.alwaysOn) ctx.ui.notify(`Advisor "${name}" is always on.`, "info");
 for (const name of result.already) ctx.ui.notify(`Advisor "${name}" is already active.`, "info");
 if (result.activated.length > 0) ctx.ui.notify(`Activated: ${result.activated.join(", ")}`, "info");
}

async function releaseAdvisors(pi: ExtensionAPI, ctx: ExtensionCommandContext, names: string[]): Promise<void> {
 const released = await deactivate(pi, ctx, names);
 const releasedSlugs = new Set(released.map((name) => slugifyAdvisorName(name)));
 for (const name of names) {
  if (releasedSlugs.has(slugifyAdvisorName(name))) continue;
  ctx.ui.notify(`Advisor "${name}" is not active.`, "warning");
 }
 if (released.length > 0) ctx.ui.notify(`Released: ${released.join(", ")}`, "info");
}

async function resetAdvisors(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
 const live = liveMainSession(pi, ctx);
 const slugs = live ? [...activeSlugs(live.sessionId)] : [];
 if (slugs.length === 0) {
  ctx.ui.notify("No on-demand advisor is active.", "info");
  return;
 }
 const released = await deactivate(pi, ctx, slugs);
 ctx.ui.notify(`Released: ${released.join(", ")}`, "info");
}

export default function advisorGate(pi: ExtensionAPI): void {
 pi.setLabel("Advisor gate");

 // Fires before built-in slash dispatch, and in interactive mode only. Never
 // return `{ handled: true }`: the skill command must still run.
 pi.on("input", async (event, ctx) => {
  const match = SKILL_COMMAND_RE.exec(event.text.trim());
  if (!match) return;
  const live = liveMainSession(pi, ctx);
  if (!live) return;
  await activate(pi, ctx, await requestedFor(pi, ctx, match[1]!, live), "slash-command");
 });

 // The path a model-invoked skill takes.
 pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "read") return;
  const match = SKILL_URL_RE.exec(event.input.path);
  if (!match) return;
  const live = liveMainSession(pi, ctx);
  if (!live) return;
  await activate(pi, ctx, await requestedFor(pi, ctx, match[1]!, live), "skill-url");
 });

 pi.registerCommand("advisors", {
  description: "Show, activate, or release on-demand advisors",
  handler: async (args: string, ctx: ExtensionCommandContext) => {
   const words = args.trim().split(/\s+/).filter(Boolean);
   const sub = words[0]?.toLowerCase() ?? "list";
   const names = words.slice(1);

   if (sub === "list" && names.length === 0) {
    await listAdvisors(pi, ctx);
    return;
   }
   if (sub === "add" && names.length > 0) {
    await addAdvisors(pi, ctx, names);
    return;
   }
   if (sub === "release" && names.length > 0) {
    await releaseAdvisors(pi, ctx, names);
    return;
   }
   if (sub === "reset" && names.length === 0) {
    await resetAdvisors(pi, ctx);
    return;
   }
   ctx.ui.notify(USAGE, "warning");
  },
 });
}

/**
 * advisor-config-compat.ts
 *
 * Local, faithful port of `discoverAdvisorConfigs`/`slugifyAdvisorName` from
 * `@oh-my-pi/pi-coding-agent/advisor/config`.
 *
 * Why this file exists: that subpath is real (it exists on disk in every
 * published version and the package's `"./*"` wildcard export covers it), but
 * it is not re-exported from the package root, so `pi.pi` cannot reach it.
 * A direct runtime import of the subpath fails on the compiled `omp` binary
 * with `Cannot find package '@oh-my-pi/pi-coding-agent'`: the compiled
 * binary resolves deep imports through a build-time virtual-module map that
 * only covers explicitly named `exports` keys (and paths some other dynamic
 * `import()` inside the bundle already reaches), and `./advisor/config` is
 * only reachable through the generic wildcard, so it never gets an entry.
 * Confirmed live against omp 18.0.4 on 2026-08-24 with a minimal
 * `--extension` reproduction; the type-only imports of the same subpath
 * (used elsewhere for `AdvisorConfig`/`DiscoveredAdvisors`) are unaffected
 * because type-only imports are erased before any runtime resolution runs.
 *
 * This port skips `@import` expansion inside an advisor's `instructions:`
 * field (the real implementation runs `expandAtImports`, itself a deep,
 * multi-hundred-line internal module with no root export either). An
 * unexpanded `@token` is left verbatim, which is exactly what the real
 * function does anyway when the referenced file can't be resolved, so this
 * only differs in behavior for a config that both uses `@import` in an
 * advisor's `instructions:` and expects it to expand — no WATCHDOG.yml in
 * this repo does.
 *
 * `tools:` validation is intentionally skipped too: `AgentSession`'s own
 * `applyAdvisorConfigs` (see `SessionAdvisors`) already intersects
 * `config.tools` against the session's real built tool instances by name,
 * so an unrecognized name here is silently dropped downstream, not a crash
 * risk.
 *
 * Delete this file and go back to the direct subpath import once the
 * package re-exports `advisor/config` from its root (matching how
 * `discoverSkills` already works via `pi.pi`), or once the compiled-binary
 * virtual-module map covers wildcard-only exports.
 */

import * as os from "node:os";
import * as path from "node:path";
import { YAML } from "bun";

export interface AdvisorConfig {
  name: string;
  model?: string;
  tools?: string[];
  instructions?: string;
  enabled?: boolean;
}

export interface DiscoveredAdvisors {
  advisors: AdvisorConfig[];
  sharedInstructions: string | undefined;
}

interface ConfigCandidate {
  path: string;
  content: string;
  level: "user" | "project";
  depth: number;
}

/** Same normalization as the real `slugifyAdvisorName`: lowercase, non-alphanumerics collapsed to `-`. */
export function slugifyAdvisorName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "advisor";
}

function gitRoot(cwd: string): string | null {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { cwd, stdout: "pipe", stderr: "ignore" });
    if (result.exitCode !== 0) return null;
    return result.stdout.toString().trim() || null;
  } catch {
    return null;
  }
}

/** Port of `collectConfigCandidates`: user agent dir, plus `<dir>/<F>` and `<dir>/.omp/<F>` from `cwd` up to the repo root (or home). */
async function collectConfigCandidates(
  cwd: string,
  agentDir: string | undefined,
  filenames: string[],
): Promise<ConfigCandidate[]> {
  const home = os.homedir();
  const repoRoot = gitRoot(cwd);
  const userPaths = new Set<string>();
  const candidates = new Set<string>();

  if (agentDir) {
    for (const filename of filenames) {
      const userPath = path.resolve(agentDir, filename);
      candidates.add(userPath);
      userPaths.add(userPath);
    }
  }

  let current = path.resolve(cwd);
  const boundary = repoRoot ?? home;
  while (true) {
    for (const filename of filenames) {
      candidates.add(path.resolve(current, ".omp", filename));
      candidates.add(path.resolve(current, filename));
    }
    if (current === boundary) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const items: ConfigCandidate[] = [];
  for (const candidate of candidates) {
    let content: string;
    try {
      content = await Bun.file(candidate).text();
    } catch {
      continue;
    }
    const parent = path.dirname(candidate);
    const baseName = parent.split(path.sep).pop() ?? "";
    const isUser = userPaths.has(candidate);
    const ownerDir = baseName === ".omp" ? path.dirname(parent) : parent;
    const ownerBaseName = ownerDir.split(path.sep).pop() ?? "";
    if (isUser || !ownerBaseName.startsWith(".") || baseName === ".omp") {
      const relative = path.relative(cwd, ownerDir);
      const depth = relative === "" ? 0 : relative.split(path.sep).filter(Boolean).length;
      items.push({ path: candidate, content, level: isUser ? "user" : "project", depth });
    }
  }

  items.sort((a, b) => {
    if (a.level !== b.level) return a.level === "user" ? -1 : 1;
    return b.depth - a.depth;
  });

  return items;
}

/** Port of `discoverAdvisorConfigs`: merge `WATCHDOG.{yml,yaml}` across the search path, keyed by slug (more-specific file wins). */
export async function discoverAdvisorConfigs(cwd: string, agentDir?: string): Promise<DiscoveredAdvisors> {
  const items = await collectConfigCandidates(cwd, agentDir, ["WATCHDOG.yml", "WATCHDOG.yaml"]);
  const advisors = new Map<string, AdvisorConfig>();
  const sharedParts: string[] = [];

  for (const item of items) {
    let parsed: unknown;
    try {
      parsed = YAML.parse(item.content);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const record = parsed as Record<string, unknown>;

    if (typeof record.instructions === "string" && record.instructions.trim()) {
      sharedParts.push(record.instructions.trim());
    }

    const rawAdvisors = record.advisors;
    if (!Array.isArray(rawAdvisors)) continue;
    for (const entry of rawAdvisors) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.name !== "string" || !e.name.trim()) continue;
      const slug = slugifyAdvisorName(e.name);
      advisors.set(slug, {
        name: e.name,
        model: typeof e.model === "string" ? e.model.trim() || undefined : undefined,
        tools: Array.isArray(e.tools) && e.tools.every((t) => typeof t === "string") ? (e.tools as string[]) : undefined,
        instructions: typeof e.instructions === "string" ? e.instructions.trim() || undefined : undefined,
        enabled: typeof e.enabled === "boolean" ? e.enabled : undefined,
      });
    }
  }

  return {
    advisors: [...advisors.values()],
    sharedInstructions: sharedParts.length > 0 ? sharedParts.join("\n\n") : undefined,
  };
}

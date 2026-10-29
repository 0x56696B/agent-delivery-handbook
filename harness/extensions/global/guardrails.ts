import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, realpathSync } from "node:fs";

// ─── Hard-blocked path patterns ────────────────────────────────────────────
// Always denied outright, no prompt. Reserved for material that should
// never be visible to the agent under any circumstance (private keys,
// cloud credentials, anything named "secrets").
// Supports:
//   - Absolute glob patterns  (e.g. ~/.ssh/*)
//   - Double-star globs       (e.g. **/.env)
// One entry per data extension rather than a "secrets.*" brace glob, because
// globToRegex (below) supports only **, *, and ? — no brace sets. This keeps
// real secret stores blocked without also blocking secrets.md, secrets.tf,
// or secrets.yml.example.
// Add or remove entries here to adjust the policy.
const HARD_BLOCKED_PATTERNS: string[] = [
  "~/.ssh/*",
  "~/.aws/credentials",
  "~/.gnupg/*",
  "**/secrets.json",
  "**/secrets.yml",
  "**/secrets.yaml",
  "**/secrets.env",
  "**/secrets.txt",
  "**/secrets.enc",
  "**/secrets.age",
  "**/secrets.gpg",
  "**/chrome-profile/**",
  // Shared test-user credentials (Playwright --secrets file, TOTP seed).
  "**/.ai-secrets",
];

// ─── Always-allowed paths ──────────────────────────────────────────────────
// Checked before the hard-block and dotenv tiers. Entries here hold
// PATTERNS ONLY, never literal secrets, so the agent may read them.
// Written against the repo path because matchPattern() resolves the
// ~/.omp symlink to roles/agent-config/files/omp.
const ALLOW_PATTERNS: string[] = ["**/roles/agent-config/files/omp/agent/secrets.yml"];

// ─── Dotenv files ──────────────────────────────────────────────────────────
// Reads are ALLOWED without a prompt. Secret VALUES are masked by the
// tool_result redactor below, so keys stay visible and a non-secret entry
// costs nothing. Templates are listed separately only to document intent:
// both tiers get the same read treatment and the same value masking, because
// only `*.example` has a first-party source confirming non-secret status
// (github/gitignore Node.gitignore re-includes `!.env.example`), while
// `.sample`, `.template`, `.dist`, `.schema`, and `.defaults` are community
// convention and can hold a real key by accident.
const DOTENV_TEMPLATE_PATTERNS: string[] = [
  "**/.env.example",
  "**/.env.example.*",
  "**/.env.*.example",
  "**/.env.sample",
  "**/.env.*.sample",
  "**/.env.template",
  "**/.env.*.template",
  "**/.env.dist",
  "**/.env.schema",
  "**/.env.defaults",
];

// Live dotenv files. `**/.env.*` also covers .env.local, .env.production,
// and .env.development.local.
const DOTENV_LIVE_PATTERNS: string[] = ["**/.env", "**/.env.*"];

// ─── Blocked commands ──────────────────────────────────────────────────────────
// Base command names (argv[0], basename only — e.g. "env" also catches
// "/usr/bin/env") that prompt for approval whenever they appear in COMMAND
// POSITION, not merely as text/arguments elsewhere in the line (so "echo env
// vars" and "grep env file" are NOT prompted, but "env", "sudo env", "cmd
// && printenv", "FOO=bar env" are).
//
// KNOWN BYPASSES (documented, not fixed — this is a guardrail, not a sandbox):
//   - command substitution: echo $(env), echo `printenv`
//   - indirection through an interpreter: bash -c env, sh -c printenv
//   - variable indirection: X=env; $X
//   - wrapper flags: "sudo -u other env" or "nice -n 5 env" are NOT
//     unwrapped — the flag/value token is (wrongly) treated as argv0, so the
//     real command escapes detection. Flag-aware unwrapping per-wrapper is
//     deliberately not implemented (unbounded shell-syntax special-casing).
//   - double-quoted line continuation: "e\<newline>nv" is elided by the real
//     shell inside double quotes too (POSIX escapes $, `, ", \, newline
//     there); this detector only elides it when UNquoted, so a double-quoted
//     line-continuation spelling of "env" is not currently caught.
//   - aliases/shell functions named differently that exec into env/printenv
//   - any language runtime reading process env directly OTHER than python's
//     `os.environ`/`os.getenv` (node process.env, ruby ENV, perl %ENV, php
//     getenv() are not covered) — see PYTHON_ENV_ACCESS_RE below for python.
// Add or remove entries here to adjust the policy.
const BLOCKED_COMMANDS: string[] = ["env", "printenv"];

// Leading wrapper commands stripped before checking the real argv0 (each may
// itself be preceded by more VAR=value assignments, which are stripped too).
// Only wrappers commonly invoked flag-free are listed — see bypass note above.
const COMMAND_WRAPPERS: Record<string, true> = {
  sudo: true,
  command: true,
  exec: true,
  nohup: true,
};

// ─── Python env-variable access ────────────────────────────────────────────
// Best-effort detection of Python code — inline `-c`, or embedded in a
// nested interpreter call — that reads process environment variables. This
// closes the most common bypass of BLOCKED_COMMANDS above: `env`/`printenv`
// are blocked, but `python3 -c "import os; print(os.environ)"` reads the
// same data and is not a "command" match.
//
// Matched against the FULL command text, not just argv0 position, so it
// also catches indirection like `bash -c "python3 -c '...'"`.
//
// KNOWN BYPASSES (documented, not fixed):
//   - a python SCRIPT FILE (not inline -c) that reads os.environ internally
//     is invisible to a static command-line check.
//   - equivalent but unlisted spellings (os.environb, ctypes/FFI getenv,
//     subprocess.run(["env"])) are not matched.
//   - other language runtimes (node, ruby, perl, php, …) are not covered.
// Add or broaden the regexes below to adjust the policy.
const PYTHON_INTERPRETER_RE = /\b(?:python3?|python2|ipython3?|py)\b/;
const PYTHON_ENV_ACCESS_RE = /\bos\.environ\b|\bos\.getenv\s*\(|\bgetenv\s*\(|\benviron\b/;

/** True if the command mentions a python interpreter AND an env-reading pattern. */
function pythonEnvAccessIn(command: string): boolean {
  return PYTHON_INTERPRETER_RE.test(command) && PYTHON_ENV_ACCESS_RE.test(command);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

/** Convert a glob pattern into a RegExp. Handles **, *, and ? metacharacters. */
function globToRegex(pattern: string): RegExp {
  const expanded = expandHome(pattern);
  const escaped = expanded
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")       // escape regex specials (not * or ?)
    .replace(/\*\*\//g, "__DOUBLE_STAR_SLASH__") // **/ → zero or more path segments (protect before *)
    .replace(/\*\*/g, "__DOUBLE_STAR__")         // trailing/bare ** → anything (protect before *)
    .replace(/\*/g, "[^/]*")                     // remaining * → match within one segment
    .replace(/\?/g, "[^/]")                      // glob ? → single non-slash char — MUST run
    // before the placeholder restores below, which introduce their own
    // literal "?" as regex syntax ("(?:.+/)?"); doing this after would
    // corrupt that syntax by treating it as a glob wildcard too.
    .replace(/__DOUBLE_STAR_SLASH__/g, "(?:.+/)?")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Strip a trailing read/grep-tool selector (":50", ":50-200", ":50+150",
 * ":raw", ":2-4:raw", ":raw:2-4", ":conflicts", …) from a path so matching
 * happens against the real file path, not the selector text — otherwise
 * `.env:raw` fails to resolve and slips past every glob below.
 */
function stripSelector(path: string): string {
  const SELECTOR = /(?::(?:raw|conflicts|\d+(?:[-+]\d*)?(?:,\d+(?:[-+]\d*)?)*)){1,2}$/i;
  return path.replace(SELECTOR, "");
}

// Internal URL schemes that address harness resources, not the filesystem.
// They cannot name a dotenv or secret file, and resolve() would mangle them
// into a bogus absolute path (omp://secrets.md → <cwd>/omp:/secrets.md).
// `vault://`, `ssh://`, and `file://` are deliberately absent: those DO
// reach real files and must stay classified.
const NON_FS_SCHEME_RE = /^(?:omp|skill|rule|memory|history|agent|artifact|security|issue|pr|mcp|local|xd):\/\//i;

/** Strip `ssh://host` so the remote path still classifies; leave others alone. */
function normalizeForMatch(path: string): string | null {
  if (NON_FS_SCHEME_RE.test(path)) return null;
  const ssh = /^ssh:\/\/[^/]*(\/.*)$/i.exec(path);
  return ssh ? ssh[1]! : path;
}

const COMPILED_BLOCKED = HARD_BLOCKED_PATTERNS.map((p) => ({
  pattern: p,
  regex: globToRegex(p),
}));
const COMPILED_ALLOW = ALLOW_PATTERNS.map((p) => ({
  pattern: p,
  regex: globToRegex(p),
}));
const COMPILED_DOTENV_TEMPLATE = DOTENV_TEMPLATE_PATTERNS.map((p) => ({
  pattern: p,
  regex: globToRegex(p),
}));
const COMPILED_DOTENV_LIVE = DOTENV_LIVE_PATTERNS.map((p) => ({
  pattern: p,
  regex: globToRegex(p),
}));

/**
 * Single choke point for every path-classifying tier below. Normalizes
 * internal URLs and ssh:// prefixes first (returning "no match" for a
 * harness-resource scheme), then resolves symlinks with realpathSync so a
 * symlink pointing into a blocked dir is also caught. Falls back to plain
 * resolve() if the path doesn't exist yet.
 */
function matchPattern(filePath: string, compiled: { pattern: string; regex: RegExp }[]): string | null {
  const normalized = normalizeForMatch(filePath);
  if (normalized === null) return null;
  const expanded = expandHome(normalized);
  let abs: string;
  try {
    abs = realpathSync(expanded);
  } catch {
    abs = resolve(expanded);
  }
  for (const { pattern, regex } of compiled) {
    if (regex.test(abs)) return pattern;
  }
  return null;
}

/** Hard-blocked: denied outright, no prompt. */
function isHardBlocked(filePath: string): string | null {
  return matchPattern(filePath, COMPILED_BLOCKED);
}

/** Always-allowed: bypasses the hard-block tier. Checked before it. */
function isAlwaysAllowed(filePath: string): string | null {
  return matchPattern(filePath, COMPILED_ALLOW);
}

/** True if the path is a dotenv file (live or template) — read tier applies. */
function isDotenvPath(filePath: string): boolean {
  return matchPattern(filePath, COMPILED_DOTENV_TEMPLATE) !== null || matchPattern(filePath, COMPILED_DOTENV_LIVE) !== null;
}

/**
 * Extract every non-flag token from a shell command string, one top-level
 * segment (split on unquoted ; | || & && newlines) at a time, quote-aware.
 *
 * NOTE: bash coverage is best-effort only. Shell features like variable
 * expansion (`F=~/.ssh/id_rsa; cat $F`), process substitution, `find`,
 * heredocs, or `cd` into a blocked directory can all bypass this check.
 * Treat it as a speed-bump against accidental access, not a security
 * boundary.
 *
 * Deliberately does NOT filter by leading path character (`/`, `~`, `./`) —
 * `cat .env` or `grep secret secrets.txt` reference sensitive files with a
 * bare relative name, and dropping the filter costs nothing (an unrelated
 * token just fails to match and adds no prompt). It DOES mean a
 * hard-blocked basename glob (the secrets.* entries) can trigger on prose
 * that merely mentions the name (e.g. `echo secrets.txt`) — accepted
 * tradeoff: missing a real bare-name read is worse than an occasional
 * over-eager block on a hard-blocked pattern.
 */
function pathsInCommand(command: string): string[] {
  const out: string[] = [];
  for (const segment of splitTopLevelSegments(command)) {
    for (const tok of tokenize(segment)) {
      if (tok && !tok.startsWith("-")) out.push(tok);
    }
  }
  return out;
}

/**
 * Quote-aware split of a shell command line into top-level segments on
 * unquoted ; | || & && and newlines. Parenthesized command substitutions
 * ($( ... )) are treated as opaque (not split into) so an operator inside
 * one doesn't fracture the outer segment.
 */
function splitTopLevelSegments(command: string): string[] {
  const segments: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      cur += c;
      if (c === quote && command[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === "\\" && i + 1 < command.length) {
      // Unquoted backslash escapes the next char literally — it is never an
      // operator, quote-opener, or command-substitution starter even if the
      // escaped char would otherwise be one (e.g. "echo \; env" is ONE
      // command; \; is a literal semicolon argument to echo, not a separator).
      cur += c + command[i + 1];
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "$" && command[i + 1] === "(") {
      parenDepth++;
      cur += c;
      continue;
    }
    if (parenDepth > 0) {
      if (c === "(") parenDepth++;
      else if (c === ")") parenDepth--;
      cur += c;
      continue;
    }
    if (c === ";" || c === "|" || c === "&" || c === "\n") {
      let j = i;
      while (j < command.length && "|&;\n".includes(command[j])) j++;
      segments.push(cur);
      cur = "";
      i = j - 1;
      continue;
    }
    cur += c;
  }
  segments.push(cur);
  return segments.map((s) => s.trim()).filter(Boolean);
}

/** Quote-aware whitespace tokenizer; strips (but does not interpret) quotes. */
function tokenize(segment: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (quote) {
      if (c === quote && segment[i - 1] !== "\\") {
        quote = null;
      } else {
        cur += c;
      }
      has = true;
      continue;
    }
    if (c === "\\" && i + 1 < segment.length) {
      // Unquoted backslash escapes the next char literally (not a token
      // separator, quote-opener, etc.), mirroring splitTopLevelSegments —
      // EXCEPT backslash-newline ("line continuation"), which the real
      // shell elides entirely (no literal char is inserted): "e\<NL>nv"
      // executes "env", not "e<NL>nv".
      if (segment[i + 1] === "\n") {
        i++;
        continue;
      }
      cur += segment[i + 1];
      has = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      has = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (has) tokens.push(cur);
      cur = "";
      has = false;
      continue;
    }
    cur += c;
    has = true;
  }
  if (has) tokens.push(cur);
  return tokens;
}

/**
 * Resolve the real argv[0] basename of a single command segment, skipping
 * leading VAR=value assignments and known no-op wrapper commands (sudo,
 * command, exec, nice, nohup, ionice), each of which may itself be preceded
 * by more assignments.
 */
function argv0Of(segment: string): string | null {
  const tokens = tokenize(segment);
  let i = 0;
  const skipAssignments = () => {
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  };
  skipAssignments();
  while (i < tokens.length) {
    const base = tokens[i].split("/").pop() ?? tokens[i];
    if (COMMAND_WRAPPERS[base]) {
      i++;
      skipAssignments();
      continue;
    }
    break;
  }
  const cmd = tokens[i];
  if (!cmd) return null;
  return cmd.split("/").pop() ?? cmd;
}

/** Return the first blocked command name found in command position, else null. */
function blockedCommandIn(command: string): string | null {
  for (const segment of splitTopLevelSegments(command)) {
    const base = argv0Of(segment);
    if (base && BLOCKED_COMMANDS.includes(base)) return base;
  }
  return null;
}

// ─── Browser auth-artifact protection (headless-login profile) ───────
// The persistent Chrome profile configured via the playwright MCP server's
// `--user-data-dir` (see mcp.json) holds a captured, already-authenticated
// Entra ID SSO session (cookies, localStorage, IndexedDB) for the
// web-app headless browser. Its CONTENTS are covered by the
// "**/chrome-profile/**" entry in HARD_BLOCKED_PATTERNS above for direct
// read/grep/bash references — but that check only inspects the path
// STRING an operation names, not files a tool visits while recursing
// (e.g. `grep pattern .` from a cwd containing the profile still walks
// into it and returns matches). Two further channels can also smuggle the
// same secret out without ever "reading a file" by name:
//
//   1. Any tool that accepts the profile path as DATA (not as "the thing to
//      read") could be pointed at it — e.g. the native `browser` tool's
//      `open.app.path` + `app.args: ["--user-data-dir=<profile>"]` would
//      spawn an independent, fully authenticated Chrome instance the agent
//      then drives with arbitrary JS via `run`. `eval` (py/js) could also be
//      handed the path as a string to open/read/zip/upload it directly.
//   2. A browser-automation tool that can execute arbitrary JS *inside an
//      already-open authenticated tab* (document.cookie, localStorage,
//      sessionStorage, indexedDB) reads the live secret without the profile
//      PATH ever appearing anywhere in the call — see BLOCKED_MCP_TOOL_NAMES
//      below, which denies those specific tool names outright rather than
//      trying to pattern-match arbitrary JS (trivially obfuscatable via
//      property-access tricks like `document['coo'+'kie']`).
//
// (1) is closed by referencesProtectedArtifact() — a blunt, tool-agnostic
// literal-substring scan applied to every tool_call's input before any
// tool-specific logic runs. The protected value is DISCOVERED from the
// project's own `.omp/mcp.json` (the playwright server's `--user-data-dir`,
// with `${HOME}`/`${PWD}`/`~` expanded to real paths) rather than hardcoded
// to one fixed location, so relocating the profile in mcp.json keeps it
// protected with no matching edit needed here. Because mcp.json stores the
// UNexpanded template text (e.g. `${PWD}/.agent-auth/chrome-profile`), the
// scan never matches mcp.json's own text, so reading/editing mcp.json to
// relocate the profile is unaffected. Read once at extension load, not per
// tool call. If mcp.json is missing, has no playwright server, or fails to
// parse, this falls back to the historical default
// `~/.agent-auth/chrome-profile`.
function expandEnvTemplate(p: string): string {
  return expandHome(p)
    .replace(/\$\{HOME\}/g, homedir())
    .replace(/\$\{PWD\}/g, process.cwd());
}

function discoverConfiguredProfilePath(): string {
  const fallback = expandEnvTemplate("~/.agent-auth/chrome-profile");
  try {
    const raw = readFileSync(join(process.cwd(), ".omp", "mcp.json"), "utf8");
    const config = JSON.parse(raw) as { mcpServers?: Record<string, { args?: string[] }> };
    const args = config.mcpServers?.playwright?.args ?? [];
    const flag = args.find((a) => a.startsWith("--user-data-dir="));
    if (!flag) return fallback;
    return expandEnvTemplate(flag.slice("--user-data-dir=".length));
  } catch {
    return fallback;
  }
}

const PROTECTED_ARTIFACT_PATHS: string[] = [discoverConfiguredProfilePath()];

/** True if any string anywhere in a tool input contains the needle. */
function inputContainsLiteral(input: unknown, needle: string): boolean {
  let text: string;
  try {
    text = JSON.stringify(input) ?? "";
  } catch {
    text = String(input);
  }
  return text.includes(needle);
}

// ─── Shared test credentials (.ai-secrets) ──────────────────────────────────
// `.ai-secrets` feeds the Playwright MCP `--secrets` flag and holds the TOTP
// seed. read/grep/bash are hard-blocked through HARD_BLOCKED_PATTERNS; every
// other tool that names the file needs approval (see the tool_call handler).
const SECRET_FILE_LITERAL = ".ai-secrets";

// `.omp/playwright/totp.mjs` reads the TOTP seed. A change to it could print
// the seed, so write, edit, and any bash command that names it (other than the
// exact run command) need approval.
const TOTP_CLI_SUFFIX = "/.omp/playwright/totp.mjs";
const TOTP_RUN_COMMAND_RE = /^node\s+(\S*\/)?\.omp\/playwright\/totp\.mjs$/;
const TOTP_TAMPER_TITLE = "Modify the TOTP CLI?";
const TOTP_TAMPER_DETAIL = "totp.mjs reads the TOTP seed. A change could print it.";
const TOTP_TAMPER_LABEL = "modify totp.mjs";

/** True if the path (selector stripped, symlinks resolved) is the TOTP CLI. */
function isTotpCli(p: string): boolean {
  const clean = stripSelector(p);
  let real: string;
  try {
    real = realpathSync(clean);
  } catch {
    real = resolve(clean);
  }
  return real.endsWith(TOTP_CLI_SUFFIX);
}

/** True if any string in the input holds a run of 5 or more asterisks. */
function inputContainsMaskRun(input: unknown): boolean {
  let text: string;
  try {
    text = JSON.stringify(input) ?? "";
  } catch {
    text = String(input);
  }
  return /\*{5,}/.test(text);
}

/**
 * True (returning the matched path) if the protected profile path appears
 * ANYWHERE in a tool call's input, regardless of which field or tool.
 *
 * KNOWN BYPASSES (documented, not fixed): only matches the literal resolved
 * path string. A path rebuilt via concatenation, an unexpanded template, or
 * a symlink alias is invisible to a substring check — same best-effort
 * caveat as the rest of this file.
 */
function referencesProtectedArtifact(input: unknown): string | null {
  for (const p of PROTECTED_ARTIFACT_PATHS) {
    if (inputContainsLiteral(input, p)) return p;
  }
  return null;
}

// MCP tool names (see the "playwright" server in mcp.json, wired to the
// protected profile above) that read live, in-session secrets through the
// authenticated page itself rather than through the filesystem — denied
// outright, no confirm tier, because arbitrary-JS payload inspection is
// trivially evadable and there is no legitimate use of these specific tools
// on a server whose only purpose is driving one authenticated session:
//   - browser_evaluate: arbitrary JS/Playwright code with full access to
//     document.cookie, localStorage, sessionStorage, and indexedDB.
//   - browser_run_code_unsafe is NOT in this list. It has the same reach plus
//     the Playwright server process. tool-approval-gate.ts runs the
//     `tool-call-auditor` review: SAFE runs with no prompt, any other result
//     shows the confirm dialog with the exact inline code plus the auditor
//     note. `filename` calls are refused here (no proof which file runs).
//   - browser_network_request(s): returns raw request/response headers,
//     which can include the OIDC `Authorization: Bearer <token>` the app
//     attaches to its own API calls.
//   - browser_console_messages: returns all console output verbatim, which
//     can echo logged tokens/session data some apps print for debugging.
// The project `.omp/config.yml` (`tools.approval`) also denies the entries
// below for the project tasks folder. That layer is separate from this list.
const BLOCKED_MCP_TOOL_NAMES: Record<string, true> = {
  mcp__playwright_browser_evaluate: true,
  mcp__playwright_browser_network_request: true,
  mcp__playwright_browser_network_requests: true,
  mcp__playwright_browser_console_messages: true,
};

// ─── Dotenv secret masking (Layer B) ───────────────────────────────────────
// Rewrites `KEY=<secret>` to `KEY=*****` in tool results for dotenv files,
// so a dotenv read never needs an interactive prompt: the key (and whether
// it is set) stays visible, only the secret part of the value is hidden.

const VALUE_MASK = "*****"; // exactly five ASCII asterisks — fixed width, not
// one asterisk per character. A length-preserving mask would leak the value
// length, which is enough to fingerprint a token format, and any mask of 8
// characters or more would collide with the Layer A regex floor in
// secrets.yml.

// Framework prefixes whose owning build tool already ships the value to the
// client bundle, so showing it adds no exposure. Sources: Next.js, Vite, CRA,
// Expo, Astro/SvelteKit first-party env-variable docs.
const PUBLIC_KEY_PREFIXES = ["NEXT_PUBLIC_", "VITE_", "REACT_APP_", "EXPO_PUBLIC_", "PUBLIC_"];

// Placeholder and template value shapes. Booleans and $VAR/${VAR} forms come
// from the gitleaks global allowlist (config/gitleaks.toml:22-67).
const PLACEHOLDER_VALUE_RE =
  /^(?:true|false|null|none|undefined|x{3,}|changeme|example|placeholder|your[-_].*|<.*>|\$\{[A-Za-z_][\w.]*\}|\$[A-Za-z_]\w*|%[A-Za-z_]\w*%)$/i;

// Union of the gitleaks generic-api-key keyword list
// (config/gitleaks.toml:648-659) and the detect-secrets KeywordDetector
// DENYLIST (detect_secrets/plugins/keyword.py:42-61).
const STRONG_SECRET_KEY_RE =
  /(^|_)(secret|password|passwd|pwd|token|credential|creds|api_?key|auth_?key|access_?key|service_?key|account_?key|db_?key|database_?key|priv(?:ate)?_?key|client_?key|client_?secret|db_?pass|database_?pass|key_?pass)($|_)/i;

const HEX_RE = /^[0-9a-fA-F]+$/;
const BASE64_RE = /^[A-Za-z0-9+/\-_]+={0,3}$/;
const MIN_ENTROPY_LEN = 20;   // original truffleHog get_strings_of_set threshold
const HEX_ENTROPY_LIMIT = 3.0;    // detect-secrets HexHighEntropyString default
const BASE64_ENTROPY_LIMIT = 4.5; // detect-secrets Base64HighEntropyString default
const MIXED_ENTROPY_LIMIT = 3.5;  // gitleaks generic-api-key entropy floor

/** Standard per-character Shannon entropy in bits over the observed distribution. */
function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Remove one matching pair of leading/trailing `"` or `'`, else return unchanged. */
function stripQuotes(s: string): string {
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Wrap `inner` in the same quote style `original` carried, or none. */
function requote(original: string, inner: string): string {
  if (original.length >= 2 && original[0] === '"' && original[original.length - 1] === '"') return `"${inner}"`;
  if (original.length >= 2 && original[0] === "'" && original[original.length - 1] === "'") return `'${inner}'`;
  return inner;
}

/**
 * Classify a single dotenv value. Evaluated in exactly this order — the
 * order is load-bearing: the strong-key rule must precede any low-entropy
 * allowance, otherwise `ADMIN_PASSWORD=letmein` classifies as safe. The
 * gitleaks "letters-only means not a secret" allowlist rule is deliberately
 * NOT ported for that reason.
 */
export function classifyEnvValue(key: string, rawValue: string): "safe" | "redact" {
  const value = stripQuotes(rawValue.trim());
  if (value === "") return "safe";
  if (PUBLIC_KEY_PREFIXES.some((p) => key.startsWith(p))) return "safe";
  if (PLACEHOLDER_VALUE_RE.test(value)) return "safe";
  if (STRONG_SECRET_KEY_RE.test(key)) return "redact";
  if (value.length >= MIN_ENTROPY_LEN) {
    if (HEX_RE.test(value) && shannonEntropy(value) > HEX_ENTROPY_LIMIT) return "redact";
    if (BASE64_RE.test(value) && shannonEntropy(value) > BASE64_ENTROPY_LIMIT) return "redact";
    if (shannonEntropy(value) > MIXED_ENTROPY_LIMIT) return "redact";
  }
  return "safe";
}

// A URL with embedded credentials: mask the password only. Host, port,
// database name, and user stay visible, because those are the parts an
// agent needs to reason about a connection string.
const URL_CREDENTIAL_RE = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/[^:/?#\s@]+:)([^@/?#\s]+)(@.*)$/;

/** Replacement value for one entry, or null to leave the line untouched. */
export function maskEnvValue(key: string, rawValue: string): string | null {
  const trimmed = rawValue.trim();
  const inner = stripQuotes(trimmed);
  const url = URL_CREDENTIAL_RE.exec(inner);
  if (url) return requote(trimmed, `${url[1]}${VALUE_MASK}${url[3]}`);
  if (classifyEnvValue(key, rawValue) === "redact") return VALUE_MASK;
  return null;
}

// Group 1 absorbs the read/grep line-number prefix (readLineNumbers: true,
// config.yml:93), including grep's one-char match marker: formatMatchLine
// (match-line-format.ts:15-19) prefixes a matched line with `*` and a
// context line with a single space before the line number, in BOTH
// hashline (`N:`) and legacy (`N|`) modes — e.g. `*4:SECRET_ID=abc`. A
// bare `\s*` never matches the `*`, so a grep hit used to reach the model
// unmasked; `[*\s]*` accepts the marker plus any indentation width the
// original `\s*` allowed (e.g. an indented `  export FOO=bar` line).
// Comment lines, blank lines, the `[file#TAG]` header, and any line
// without `=` fail the match and pass through untouched.
const ENV_LINE_RE = /^([*\s]*(?:\d+[:|]\s?)?)((?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;

/** Index of the first `quote` character in `s` not preceded by a backslash, else -1. */
function findUnescapedQuote(s: string, quote: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === quote && s[i - 1] !== "\\") return i;
  }
  return -1;
}

/**
 * Mask every secret value in a block of dotenv text, line by line. Handles a
 * multi-line quoted value (e.g. a PEM block pasted into a dotenv file): if a
 * value opens a quote that isn't closed on the same line, every line up to
 * and including the closing quote is consumed and replaced by one masked
 * line, because a quoted multi-line value is never a plain config scalar.
 */
export function redactDotenvText(text: string): { text: string; masked: number } {
  const lines = text.split("\n");
  const out: string[] = [];
  let masked = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = ENV_LINE_RE.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, prefix, exportWord, key, operator, rawValueRest] = m;
    const firstChar = rawValueRest.length > 0 ? rawValueRest[0] : "";
    if (firstChar === '"' || firstChar === "'") {
      const rest = rawValueRest.slice(1);
      if (findUnescapedQuote(rest, firstChar) === -1) {
        // Unbalanced quote — the value continues on following lines.
        let j = i + 1;
        while (j < lines.length && findUnescapedQuote(lines[j], firstChar) === -1) j++;
        out.push(`${prefix}${exportWord}${key}${operator}${VALUE_MASK}`);
        masked++;
        i = j < lines.length ? j : lines.length - 1;
        continue;
      }
    }
    const replacement = maskEnvValue(key, rawValueRest);
    if (replacement !== null) {
      out.push(`${prefix}${exportWord}${key}${operator}${replacement}`);
      masked++;
    } else {
      out.push(line);
    }
  }
  return { text: out.join("\n"), masked };
}

/** True if a `read`/`grep`/`bash` tool call's input touches a dotenv path. */
function resultTouchesDotenv(toolName: string, input: Record<string, unknown>): boolean {
  if (toolName === "read") {
    return isDotenvPath(stripSelector(String(input.path ?? "")));
  }
  if (toolName === "grep") {
    return String(input.path ?? ".")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .some((root) => isDotenvPath(stripSelector(root)));
  }
  if (toolName === "bash") {
    return pathsInCommand(String(input.command ?? "")).some((t) => isDotenvPath(t));
  }
  return false;
}

const MASK_WRITEBACK_REASON = (toolName: string): string =>
  `guardrails: '${toolName}' would write the mask '*****' into a dotenv file. Those asterisks are not the real value, which was never shown to you. Ask the user for it, or ask the user to make this edit if the file really does contain asterisks.`;

// The `edit` tool's hashline mode takes only `{ input: string }` — there is
// no `path` field in its tool_call input. Every edited file is instead named
// by a `[PATH#TAG]` section header inside that diff-language text, so the
// mask-writeback guard below must recover the path(s) from there. Mirrors
// the header regex the harness's own hashline parser uses
// (streaming.ts splitHashlinePerFile), so this stays in sync with what the
// tool actually recognizes as a section boundary.
const EDIT_HEADER_RE = /^\s*\[([^\]\r\n]+?)(?:#[0-9a-fA-F]{4})?\]\s*$/gm;

/** Every `[PATH#TAG]` section header path in an edit tool's diff-language input. */
function editHeaderPaths(rawInput: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  EDIT_HEADER_RE.lastIndex = 0;
  while ((m = EDIT_HEADER_RE.exec(rawInput))) out.push(m[1]!.trim());
  return out;
}

// Managed-by header the agent must write as the exact first line of any
// `.env.local` it creates, so a later `write` call can tell an agent-owned
// override file from a pre-existing one that may hold real secrets.
const MANAGED_HEADER = "# managed-by: omp-agent (non-secret overrides only)";

/** True if `path` exists, is readable, and its first 200 bytes lack MANAGED_HEADER. */
function existsWithoutManagedHeader(path: string): boolean {
  try {
    const head = readFileSync(path, "utf8").slice(0, 200);
    return !head.startsWith(MANAGED_HEADER);
  } catch {
    return false;
  }
}

// ─── Hook factory ─────────────────────────────────────────────────────────────

export default function guardrails(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    const { toolName, input } = event;

    // ── Cross-tool protected-artifact guard (checked before anything else) ──
    const artifactHit = referencesProtectedArtifact(input);
    if (artifactHit) {
      return {
        block: true,
        reason: `guardrails: '${toolName}' call references the protected auth artifact '${artifactHit}' — its contents may never reach the agent through any tool`,
      };
    }
    if (BLOCKED_MCP_TOOL_NAMES[toolName]) {
      return {
        block: true,
        reason: `guardrails: '${toolName}' is permanently denied — it can read live session secrets (cookies/localStorage/headers) from the authenticated browser profile`,
      };
    }

    /** Prompt for approval; returns a block result on decline/no-UI, else undefined. */
    const confirmAccess = async (
      title: string,
      detail: string,
      label: string,
    ): Promise<{ block: true; reason: string } | undefined> => {
      if (!ctx.hasUI) {
        return { block: true, reason: `guardrails: '${label}' requires interactive approval, but no UI is available` };
      }
      const approved = await ctx.ui.confirm(title, detail);
      if (!approved) {
        return { block: true, reason: `guardrails: '${label}' was declined by user` };
      }
      return undefined;
    };

    // Any tool other than read/grep/bash (which the hard block covers) that
    // names the shared test-credential file needs approval: write, edit, eval,
    // inline run_code_unsafe. Approve only for expected edits such as .omp/mcp.json.
    if (
      toolName !== "read" &&
      toolName !== "grep" &&
      toolName !== "bash" &&
      inputContainsLiteral(input, SECRET_FILE_LITERAL)
    ) {
      const denial = await confirmAccess(
        `Allow ${toolName} to reference .ai-secrets?`,
        "The call names the shared test-credential file. Approve only if you expect this (for example an edit to .omp/mcp.json).",
        `${toolName} .ai-secrets`,
      );
      if (denial) return denial;
    }

    // run_code_unsafe: guardrails refuses `filename` (the tool runs the file
    // instead of `code`, and this hook cannot prove which file the Playwright
    // server resolves) and empty `code`. Review by the tool-call-auditor model
    // and the approval dialog live in tool-approval-gate.ts.
    if (toolName === "mcp__playwright_browser_run_code_unsafe") {
      if (input.filename) {
        return {
          block: true,
          reason: "guardrails: run_code_unsafe with `filename` is refused. Pass the code inline in `code` so it can be shown before approval.",
        };
      }
      const code = typeof input.code === "string" ? input.code : "";
      if (code === "") {
        return { block: true, reason: "guardrails: run_code_unsafe needs non-empty inline `code`" };
      }
      return undefined;
    }

    /**
     * Hard-block a single content-exposing path, unless it is always-allowed.
     * Shared by `read` and `grep` — both can return file CONTENTS, unlike
     * `glob` (names only, intentionally not gated). Strips read/grep
     * selectors (":50", ":raw", …) before matching. Dotenv reads are not
     * gated here: they are allowed through, and their secret values are
     * masked by the tool_result handler below instead of being prompted.
     */
    const checkContentPath = (rawPath: string): { block: true; reason: string } | undefined => {
      const path = stripSelector(rawPath);
      if (isAlwaysAllowed(path)) return undefined;
      const hardHit = isHardBlocked(path);
      if (hardHit) {
        return { block: true, reason: `guardrails: '${rawPath}' matches blocked pattern '${hardHit}'` };
      }
      return undefined;
    };

    // ── read tool ──────────────────────────────────────────────────────────────
    if (toolName === "read") {
      const denial = checkContentPath(String(input.path ?? ""));
      if (denial) return denial;
    }

    // ── grep tool ─────────────────────────────────────────────────────────────
    // `path` may be a semicolon-delimited list of roots, each possibly
    // carrying a ":<lines>" selector; grep returns matching LINE CONTENT so
    // it is exactly as sensitive as `read`.
    if (toolName === "grep") {
      const roots = String(input.path ?? ".")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const root of roots) {
        const denial = checkContentPath(root);
        if (denial) return denial;
      }
    }

    // ── write tool ────────────────────────────────────────────────────────────
    if (toolName === "write") {
      const path = stripSelector(String(input.path ?? ""));
      if (isTotpCli(path)) {
        const denial = await confirmAccess(TOTP_TAMPER_TITLE, TOTP_TAMPER_DETAIL, TOTP_TAMPER_LABEL);
        if (denial) return denial;
      }
      if (isDotenvPath(path) && inputContainsMaskRun(input)) {
        return { block: true, reason: MASK_WRITEBACK_REASON(toolName) };
      }
      if (isDotenvPath(path) && existsWithoutManagedHeader(path)) {
        const denial = await confirmAccess(
          `Overwrite ${path}?`,
          `${path} exists and is not marked '${MANAGED_HEADER}'. Overwriting replaces the whole file, including any secrets it holds.`,
          `overwrite ${path}`,
        );
        if (denial) return denial;
      }
    }

    // ── edit tool ─────────────────────────────────────────────────────────────
    // Surgical and cannot clobber a whole file, so it stays otherwise
    // ungated. Only a mask write-back is blocked: never let the placeholder
    // itself land in a dotenv file as if it were a real value. The edit
    // tool has four modes (src/edit/index.ts): patch and replace put `path`
    // directly in the tool_call input; hashline and apply_patch put only
    // `input` (a diff-language string) and name each edited file with a
    // `[PATH#TAG]` section header instead — so both sources are checked.
    if (toolName === "edit") {
      const directPath = String(input.path ?? "");
      const headerPaths = editHeaderPaths(String(input.input ?? ""));
      const candidatePaths = directPath ? [directPath, ...headerPaths] : headerPaths;
      if (candidatePaths.some((p) => isDotenvPath(stripSelector(p))) && inputContainsMaskRun(input)) {
        return { block: true, reason: MASK_WRITEBACK_REASON(toolName) };
      }
      if (candidatePaths.some((p) => isTotpCli(p))) {
        const denial = await confirmAccess(TOTP_TAMPER_TITLE, TOTP_TAMPER_DETAIL, TOTP_TAMPER_LABEL);
        if (denial) return denial;
      }
    }

    // ── bash tool ─────────────────────────────────────────────────────────────
    if (toolName === "bash") {
      const command = String(input.command ?? "");

      for (const candidate of pathsInCommand(command)) {
        if (isAlwaysAllowed(candidate)) continue;
        const hardHit = isHardBlocked(candidate);
        if (hardHit) {
          return { block: true, reason: `guardrails: command references '${candidate}' which matches blocked pattern '${hardHit}'` };
        }
      }

      // TOTP CLI tamper gate. Only the exact run command passes without a prompt.
      if (pathsInCommand(command).some((t) => isTotpCli(t)) && !TOTP_RUN_COMMAND_RE.test(command.trim())) {
        const denial = await confirmAccess(TOTP_TAMPER_TITLE, TOTP_TAMPER_DETAIL, TOTP_TAMPER_LABEL);
        if (denial) return denial;
      }

      const approvalRequiredFor = blockedCommandIn(command);
      if (approvalRequiredFor) {
        const denial = await confirmAccess(
          `Run ${approvalRequiredFor}?`,
          `The command may expose environment variables:\n\n  ${command}`,
          approvalRequiredFor,
        );
        if (denial) return denial;
      }

      if (pythonEnvAccessIn(command)) {
        const denial = await confirmAccess(
          "Allow Python environment-variable access?",
          `The command appears to read process environment variables from Python:\n\n  ${command}`,
          "python env access",
        );
        if (denial) return denial;
      }

      if (pathsInCommand(command).some((t) => isDotenvPath(t)) && inputContainsMaskRun(input)) {
        return { block: true, reason: MASK_WRITEBACK_REASON(toolName) };
      }
    }
  });

  // ── Layer B: mask dotenv secret values in tool results ──────────────────────
  pi.on("tool_result", async (event) => {
    if (event.isError) return;
    if (event.toolName !== "read" && event.toolName !== "grep" && event.toolName !== "bash") return;
    if (!resultTouchesDotenv(event.toolName, event.input)) return;

    let masked = 0;
    const content = event.content.map((chunk) => {
      if (chunk.type !== "text") return chunk;
      const { text, masked: n } = redactDotenvText(chunk.text);
      if (n === 0) return chunk;
      masked += n;
      return { ...chunk, text };
    });
    if (masked === 0) return undefined;

    content.push({
      type: "text",
      text: `guardrails: masked ${masked} secret value(s) with *****. Every key you see exists and is set; only the secret part of the value is hidden. Ask the user for a value you need, and never write ***** into a file.`,
    });
    return { content };
  });
}

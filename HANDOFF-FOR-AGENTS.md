# HANDOFF-FOR-AGENTS

Agent-facing guide to the handoff pack. The pack root is `handoff/`. Every path below is relative to the pack root unless it starts with `<tasks-root>`, `~`, `.omp/`, or `.claude/` (install targets).
`README.md` is the human-level index. This file is decision data: what exists, what it needs, what is broken, what to ask. Start at Section 1 after reading Section 0.

Provenance. While writing this guide every cited path was checked to exist, and every contradiction in Section 8.1 was checked in the files named in its row. Skill bodies were read where cited; not every line of every skill was re-read. Operating history (incidents, audits, measurements, user decisions) comes from the author's session logs, decision records, and audits, which are not shipped in the pack. Fall IDs (A1, H2, G3, S4, T5, P6, Q1, C2, V3) are stable labels from that history and are defined in Section 7. `[INFERENCE]` marks a claim the sources do not prove. When a pack file and this guide disagree, the pack file is the evidence and this guide is stale: tell the human.

Contents: 0 Purpose and use. 1 Steal list. 2 Pack manifest and install map. 3 Placeholders. 4 Operating invariants. 5 Lifecycle protocol. 6 Gate policy. 7 Failure modes. 8 Contradictions and gaps. 9 Adoption procedure. 10 Skill index. 11 Glossary.

## 0. Purpose and how to use

### 0.1 Your job
You are an AI agent. A human asked you to help adopt, mine, or audit the workflow in this pack. Do three things: analyze (what the human does today, what the pack does), extract (pick artifacts), adapt (fill placeholders, translate to the human's harness, fix known defects). Do not reinvent. Each artifact encodes fixes for failures that cost real time (Section 7). A fresh design loses those fixes without a trace.

### 0.2 Pick a mode
| Mode | Human intent | Read first | Output |
|---|---|---|---|
| A. Adopt | "Set this workflow up for me." | 9, 3, 2, 8 | Installed artifacts, filled placeholders, one passing smoke test |
| B. Mine | "I want X from it" (one skill, one gate, one script) | 1.2, 1.1, 2.3 | The named artifact adapted, with its dependencies listed |
| C. Audit | "Compare my setup with this one." | 9.1, 9.2, 4, 7 | Gap table: practice, present or absent, evidence, recommended artifact |

### 0.3 Ground rules for you
1. Read the pack file before you describe it. This guide indexes the pack. It does not replace it. Never quote pack behavior from memory.
2. The pack contains no secrets. Never look for any. Never read, print, or copy a real `mcp.json`, `.env`, or credential file in the human's environment. If a real `mcp.json` exists, do not open it: ask the human to add the missing server entries from `harness/mcp.template.json` (variable names only, never values). A masked value `*****` means set and hidden: never write the mask, never guess the value, ask the human.
3. Keep every gate at least as strong as shipped (Section 6). If the human wants a gate weakened, get a clear instruction and name the failure class it reopens (Section 7).
4. Fill placeholders from the human's environment with tools first (Section 3). Ask only what no tool answers: one message, with options and your recommendation.
5. Mark any conclusion you did not verify as `[INFERENCE]` and name its evidence. Say "I do not know" when you do not.
6. Skills, extensions, commands, settings, and rules created mid-session do not load. After installing, tell the human to restart the harness, then verify in a fresh run (H4).
7. Work in copies. Edit the pack in place only when the human asks.
8. Cite by file path plus heading or step name. Step numbers drift when a skill is renumbered.
9. Do not promise anything listed as unproven in Section 8.4.

### 0.4 Notation
- Tasks root: `~/work/<PROJECT>/tasks`. The harness starts there. Bare clones sit one level up: `~/work/<PROJECT>/<repo>-bare`. A session never touches that parent.
- Roles, never names: the author (the human who owns the setup), `<TECH_LEAD>`, `<QA_TESTER>`, `<PRODUCT_OWNER>`, `<TEAMMATE>`, `<MANAGER>`.
- Repo roles the skills hard-code: `orchestrator` (backend API that runs the LLM agent), `web-app` (React and Vite front end), `media-mcp`, `data-mcp`, `file-gateway`, `infra` (Terraform only), `legacy-agent` (being retired, standing exclusion). Map your repos onto these roles or generalize the skills (Section 3.2).
- Reference harness: OMP. OMP names (`skill://`, `vault://`, `move_session`, `services`, `.omp/`) appear throughout the pack. Sections 2.2 and 2.4 give equivalents and fallbacks.
- Skill-directed: a loaded skill step tells the agent to do the action, and that step is the authorization (Section 6).
- Effort legend (guide author's estimate, [INFERENCE]): S = under an hour of agent work plus one human confirmation. M = about a day including a smoke test. L = several days, or needs work in the human's environment (access, servers, accounts).
- ASCII arrows `->` mean "moves to" or "leads to".

### 0.5 What the pack is
A ticket-to-merge workflow for one engineer with many agents, plus the memory method (a wiki vault), the harness setup (rules, guards, config), unattended ingest jobs, and the lessons from about three months of daily use.

```
intake -> triage -> bootstrap -> [bug: reproduce -> plan -> test-first fix -> live verify]
                             or  [story: contract gate -> plan -> implement -> verification gate]
 -> security gate -> PR -> PR-open notice -> review loop (comments, conflicts) -> merge
 -> post-merge handoff -> deployed-to-QA proof -> tester closes or product owner accepts -> cleanup
side rails: local services control, guards and approvals, vault memory, unattended board and chat ingest
```

It is one working system, not a framework. Parts depend on each other (Section 10, column "depends on"). Adopt in layers (Section 9.5).

### 0.6 Read this before you promise a working install
- Section 8.1 lists contradictions between shipped skills. Resolve them in your copy before the first run.
- Section 8.2 lists files that shipped skills and scripts need but the pack does not contain.
- Section 8.3 lists environment-specific residue (macOS commands, hard-coded topology, identity-provider details).
- Section 8.4 lists claims that no live run proved.

### 0.7 Fast path
1. Pick the mode (0.2). Read Section 1 and the rows that match the human's pain.
2. Run the inventory (9.1) and score the candidates (9.3).
3. Resolve placeholders with tools (3.5). Ask one batched question for the rest.
4. Fix or decide every Section 8.1 item in the installed copies (9.7).
5. Install in layers with a restart and a fresh-run check after each (9.5). Guards come before autonomy.
6. Smoke-test one sandbox ticket with negative controls (9.8). Report only what you ran (9.10).

## 1. Steal list

### 1.1 Ranked artifacts
Rank = expected value to a new adopter first, then low effort. The rank is the guide author's judgment: re-rank with the rubric in Section 9.3. Portability: **drop-in** = copy with trivial edits; **adapt** = fill Section 3 placeholders and fix Section 8 items; **concept only** = reimplement the idea for the target harness. "Tracker MCP" means the Azure DevOps MCP server (`azure-devops` in `harness/mcp.template.json`). Effort is the legend in 0.4.

| # | Artifact (paths) | What it gives | Portability | Prerequisites | Effort |
|---|---|---|---|---|---|
| 1 | `harness/global/APPEND_SYSTEM.md`, `harness/global/RULES.md`, `rules/global/read-tool-first.md`, `rules/global/no-redundant-reverify.md`, `rules/global/no-emoji.md` | Honesty and communication contract: say "I do not know", check with a tool before stating a fact, mark `[INFERENCE]`; answer first in 10 lines or fewer; translate tracker codes; drafts in fenced blocks posted only on clear approval; ASD-STE100 prose; a clean verdict is terminal; read tool before shell reads | drop-in (text). Delete the wiki, `end_session`, and `clear_context` blocks if you lack those tools. Fill `<VAULT_ROOT>` | A global instruction file. Rule frontmatter (`alwaysApply`, `condition`, `scope`) is OMP format; elsewhere paste the bodies into the instruction file | S |
| 2 | `harness/project/AGENTS.md`, `harness/project/RULES.md` | One constants file (org, repos, identity, tracker vocabulary table, state ladders, environments, folder conventions) and the gate prose with its exception list. Ended repeated corrections and let 11 to 13 skills stop repeating facts | adapt placeholders | None for the text. Enforcement needs rows 6 and 7 | S |
| 3 | `rules/global/BUG_FIXING.md`, `skills/regression-test-placement/SKILL.md` | Six-part bug discipline (reproduce at the true failure boundary, auth blockers, multi-repo design and deploy-order walk, trust-but-verify design docs, live verification, delegation briefs). Placement table from "what broke" to "where the test goes", two-form mutation check, catalogue-case recipe | `BUG_FIXING.md` drop-in. Placement skill: adapt (rows name the `orchestrator` e2e contracts file, a prompt catalogue, a media test, component tests, browser journeys) | git, a test runner per stack. Catalogue rows need a prompt-regression suite and a nightly pipeline | S for the rule, M for the skill |
| 4 | `scripts/setup-task-branch.sh`, `skills/ticket-bootstrap/SKILL.md`, `skills/task-branch-script-internals/SKILL.md`, `skills/repo-onboarding/SKILL.md` | One folder per ticket (`{TYPE}-{NUM}-{summary}`) of relative repo symlinks over per-branch git worktrees of bare clones. Idempotent script: shared `.env` symlink, duplicate-folder guard, `excluded_repos` array, `--pr` review mode, explicit fetch refspecs. Skills add returned-bug detection, colleague-branch pickup, bare-clone onboarding | adapt: bash tested on macOS; edit `excluded_repos`; assumes `<repo>-bare` dirs one level above the tasks root | git worktrees, bash, bare clones, tracker MCP (fetch, state), `move_session` or a human `cd` | M |
| 5 | `skills/pr-security-gate/SKILL.md`, `agents/pr-security.md`, `scripts/secret-scan.sh`, `scripts/self-review.sh`, `scripts/gitleaks.toml`, `scripts/gitleaks-report.tmpl` | Pre-PR gate: fail-closed secret scan (commits, staged, unstaged, untracked), diff self-review, read-only `pr-security` verdict with an origin rule (introduced or pre-existing) and dispositions (fix-now, defer-bug, false-positive), at most 2 fix rounds, draft-PR path, remote-exposure check, `SECURITY-GATE.md` record | Scripts drop-in. Skill: adapt (ADO tools for filing Bugs). Agent frontmatter is OMP format | `gitleaks` binary, bash, git, subagent support with a read-only tool allowlist, tracker MCP for deferred Bugs | S to M |
| 6 | `harness/extensions/global/guardrails.ts`, `harness/extensions/project/no-parent-folder-guard.ts`, `harness/extensions/project/process-ownership-guard.ts` | Deterministic `tool_call` hooks: block secret, key, and browser-profile access; mask dotenv values; block parent-folder access (lexical, bash-aware to depth 3); block stop and kill of processes this session did not start | concept only outside OMP (rewrite as PreToolUse hooks). In OMP: adapt (set `PROJECT_DIR`, remove the author-specific `ALLOW_PATTERNS` entry) | OMP extension API (only `import type` from the harness package works in the compiled binary), restart to load | M in OMP, L elsewhere |
| 7 | `harness/project/config.yml`, `harness/extensions/global/tool-approval-gate.ts`, `harness/global/tool-call-auditor.md`, `harness/project/tool-call-auditor.md`, approval keys in `harness/global/config.yml` | Deny and prompt lists for write tools; conditional rule that auto-allows only area path, iteration path, and self-assign writes; model review (auditor) of work-item comments and Playwright code; fail-closed governed tools | adapt (tool names use OMP spelling; identity regex needs `<YOUR_EMAIL_ESCAPED>`) | OMP, a small model role named `tool-call-auditor` (optional; without it the call prompts), the MCP servers. Auditor SAFE path unproven live (U1) | M |
| 8 | `skills/bug-workflow/SKILL.md`, `agents/error-detective.md`, `commands/bug.md` | Full bug path: returned-bug Step 0 with a QA-versus-local decision table, repro doc, debugger-based root cause, per-repo fix plans, test first, mutation check, live verify, one commit per repo, PR gate checklist, state holds (`Ready for Fix` until merge) | adapt (tracker names, repo roles, `services` tool, `debug` tool, flows) | Rows 3 to 7 and 13, tracker MCP, subagents, Playwright MCP for UI bugs | L |
| 9 | `skills/story-refinement/SKILL.md`, `skills/story-workflow/SKILL.md`, `skills/ticket-triage/SKILL.md`, `skills/ticket-triage-profile/SKILL.md`, `skills/third-party/grilling/SKILL.md`, `commands/story.md`, `commands/triage.md` | Two-session story method. Session A (or `/triage`) grills the human and writes a six-section Agent Contract into the ticket. Session B starts blank, trusts only the ticket, gates on the contract, implements, passes an 8-item verification gate, opens the PR. `ticket-triage` adds brief, teach-back, one-question grilling, and a tiered, wave-ordered task spec | `ticket-triage` and `grilling` drop-in (vendor-neutral; `ticket-triage` needs a profile). Others adapt. Decide X1 first | tracker MCP, subagents (`scout`), `grilling`, Big-tier model for `/triage` | M to L |
| 10 | `skills/pr-creation/SKILL.md`, `skills/pr-and-team-comms/SKILL.md` | Conventional-commit title, two description templates (200 words or fewer), forbidden-wording table, verified work-item link, standing reviewers, safe auto-complete order, one-line PR-open Slack notice via rich-text blocks, filing a Bug from a finding | adapt (reviewer table, repo GUIDs, channels, tracker URLs) | tracker MCP (PR tools), `az` for policy reads and required reviewers, Slack MCP with the write tool | M |
| 11 | `skills/pr-merge/SKILL.md`, `skills/pr-comments/SKILL.md`, `skills/merge-conflict/SKILL.md`, `skills/my-pr-status/SKILL.md`, `rules/project/pr-thread-resolution.md`, `commands/pr-merge.md`, `commands/comments.md`, `commands/conflict.md`, `commands/pr-status.md` | Merge gate table (approvals, threads, conflicts, pipeline freshness, paired-PR order, policies), one combined ask, squash auto-complete. Reproduce-before-fix thread resolution with evidence replies. Merge-not-rebase conflict resolution with patch proof. Fixed PR status card | adapt (ADO, `az repos pr policy list`) | tracker MCP, `az` session for policies, `ask` tool, Slack DM, a subagent for conflict resolution | M to L |
| 12 | `skills/pr-review/SKILL.md`, `skills/pr-review/COMMENT-STYLE-NOTES.md`, `agents/architect-reviewer.md`, `commands/ado-review.md`, advisor `PRSecurity` in `harness/project/WATCHDOG.yml` | Three parallel read-only lanes (security, quality, architecture). The main agent checks each claim against code and writes one verified two-part report. Thread anchor rule. The vote rule (check auto-complete first) lives in `harness/project/RULES.md`, not in the skill | adapt | `scripts/setup-task-branch.sh --pr`, subagent types `security-reviewer` and `reviewer` (OMP built-ins) or your equivalents, advisor support (optional) | M |
| 13 | `rules/project/tool-gotchas.md`, `rules/project/azure-cli-fallback.md`, `rules/project/no-parent-folder-repo-access.md`, `rules/project/task-files-in-ticket-folder.md`, `rules/project/ado-ticket-voice.md`, `rules/project/ado-area-path.md` | Tool traps with fixes (symlinks and `grep`, project argument, 300 s cap, one state per write), CLI-for-login-only, parent-folder ban, no `/tmp` scratch, plain first-person ticket voice, area path on every write | drop-in after placeholders. `ado-area-path` is a template for a temporary board override (E13) | tracker MCP. Conditional rules need OMP rule matching | S |
| 14 | `harness/extensions/project/services/index.ts`, `harness/extensions/project/services/plan.ts`, `harness/extensions/project/services/plan.test.ts`, `skills/service-startup-reference/SKILL.md`, `rules/project/services-via-services-tool.md`, `rules/project/no-orphan-processes-after-use.md`, `rules/project/teardown-verification-tooling-after-pr.md` | One owner per port: a custom tool starts services, wires siblings, health-checks by log regex, stops, and reports the real port. Cross-wiring proof, debug-attach procedure, the single PR-build checks table, teardown rules | adapt: edit the `SERVICES` table in `plan.ts` and the per-service facts in the skill. The tool is OMP only | OMP extension API, Docker (the tool starts the orchestrator's database container with `docker compose`), `lsof`, `uv`, `pnpm` | M to L |
| 15 | `skills/post-merge/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md`, `skills/deployed-version-check/SKILL.md`, `commands/qa-deployed.md` | Dev deploy check, dev evidence, tester handoff document and ticket comment draft. `git merge-base --is-ancestor` proof that a fix is inside a deploy. Per-repo deploy-trigger report with a confidence rating | adapt (pipeline ids, trigger patterns, subscription and app-service names) | tracker pipelines MCP, `az rest` for live App Service config, git clones fetched with explicit refspecs | M |
| 16 | `skills/morning-brief/SKILL.md`, `skills/daily-work-poll/SKILL.md`, `automation/board-ingest/run.sh`, `automation/board-ingest/prompt.md`, `automation/board-ingest/overlay.yml`, `automation/board-ingest/install.sh`, `automation/board-ingest/uninstall.sh`, `commands/morning.md` | An unattended board read writes a brief into the vault. The agent applies the proposed state moves after one approval. Three-source daily poll | adapt; cron scripts are macOS-specific (E1). Keep `automation/board-ingest/prompt.md` even without cron: `skills/pr-merge/SKILL.md` cites its Step 7 table and `skills/morning-brief/SKILL.md` cites its steps 5 to 7 | vault, tracker MCP, headless harness run, cron | M to L |
| 17 | `skills/e2e-verification/SKILL.md`, `skills/flow-schema/SKILL.md`, `agents/flow-runner.md`, `automation/playwright/totp.mjs`, `automation/playwright/totp.test.mjs`, `automation/playwright/config.json`, `automation/playwright/windows-client-hints-init.js` | Per-service auth facts. Test-user login by key name with the TOTP code from a CLI (no secret in context). One `flow.yaml` run three times (broken build, fixed build, QA) by a cheap vision model | adapt; high coupling to the author's identity-provider setup. Do not copy `config.json` and the init script without approval (E5) | Playwright MCP with `--secrets` and `--isolated`, a test account and TOTP seed, running services, two vault notes that are not bundled (M2) | L |
| 18 | `vault/schema.md`, `vault/index.md`, `vault/log.md`, `vault/templates/`, `vault/views/`, `skills/wiki-spec/SPEC.md`, `rules/global/vault-writes-via-vault-uri.md`, `harness/global/WATCHDOG.yml` | Typed-page personal wiki: schema contract, 8 templates, 6 Obsidian Bases views, append-only log, immutable `raw/`. Eight `wiki-*` skills. `WikiScribe` advisor that files durable facts | kit drop-in. Skills: adapt (`vault://` addressing) | Obsidian (for `.base` views), `vault://` support or plain file tools, optional advisor | M |
| 19 | `automation/slack-ingest/run.sh`, `automation/slack-ingest/prompt.md`, `automation/slack-ingest/overlay.yml`, `automation/slack-ingest/install.sh`, `automation/slack-ingest/uninstall.sh` | Unattended per-day Slack digest into the vault with oldest-first backfill (cap 21 days), a log-line idempotency guard, inbox tasks for actionable findings | adapt; macOS `date` and `stat` syntax (E1); harden the overlay (E4) | Slack MCP (read), headless harness run, cron, vault, a `[[team-tasks]]` project page (M5) | M |
| 20 | `commands/` (11 files) | Entry points under 10 lines that name a skill and pass `$1`. They cannot drift from the skill because they never restate steps | drop-in shape. Replace `skill://` reads with your harness's skill loading. Decide X1 | slash-command support with positional arguments | S |
| 21 | `skills/third-party/` (3 skills, `CREDITS.md`, `LICENSE`) | Generic upstream skills: `grilling` (used by two project skills), `grill-me`, `research` | drop-in. MIT, keep the upstream `LICENSE` with the copies | skills loader | S |
| 22 | `scripts/cleanup-task-folders.sh`, `skills/task-cleanup/SKILL.md`, `commands/cleanup.md` | Report first, dry-run by default, refuses dirty, ahead, or diverged repos and folders under 7 days, archives markdown, removes the worktree's Docker resources, applies only to items the human names | adapt (`stat -f` is macOS, `declare -A` needs bash 4, keep-list names; E1, E2) | bash 4 or newer, git, Docker (optional), tracker MCP for PR and ticket state | S to M |
| 23 | `skills/checkmarx-handling/SKILL.md` | Static-scan report handling: find the build, read per-engine counts, CLI artifact download (the MCP download writes 0 bytes), triage each finding with `file:line`, one Bug per real finding, vault note | concept portable. Adapt pipeline ids and the dated per-repo section | tracker pipelines MCP, `az pipelines runs artifact download`, a scan stage in CI | S to M |
| 24 | `harness/mcp.template.json` | Four MCP servers (`azure-devops`, `azure-mcp`, `playwright`, `slack`) with env-var-name indirection: the value in an `env` block is the NAME of a shell variable | adapt. Pin Playwright and add `--isolated` (X20) | Node `npx`, a scope-limited PAT, a Slack user token, relaunch after exporting variables | S |
| 25 | `rules/project/py-runtime-assert.md`, `rules/project/py-log-exception.md` | Two Python rules with bad and good examples | drop-in for Python repos, otherwise skip | rule matching on `*.py` edits (OMP) or paste into an instruction file | S |
| 26 | `harness/global/WATCHDOG.yml`, `harness/global/WATCHDOG.md`, `harness/project/WATCHDOG.yml`, `harness/extensions/global/advisor-gate.ts`, `harness/extensions/global/advisor-drain.ts`, `harness/extensions/global/lib/advisor-config-compat.ts` | Second-model watchers: `default` (process-discipline watch list), `PRSecurity` (dormant until `pr-review` loads), `WikiScribe` (files durable facts at run end). Silence-as-approval note rules. A drain hook so a vault write is not lost | concept only outside OMP | OMP advisor runtime. Cost control: `advisor.reviewMode: agent-end` (V3) | M in OMP |
| 27 | `harness/extensions/global/move-session.ts`, `harness/extensions/global/end-session.ts`, `harness/extensions/global/clear-context.ts`, `harness/extensions/global/compact-context.ts` | Tools so the agent moves, closes, clears, or compacts the session when asked in plain words; return to the root after a clear | concept only | OMP extension API with a UI | M in OMP |
| 28 | `scripts/setup-task-lsp.sh`, `harness/project/dap.json` | Makes a task folder a self-contained LSP and DAP workspace: installs repos, writes `lsp.json`, `dap.json`, `pyrightconfig.json` | adapt heavily: hard-coded repo names, ports, launch modules, macOS browser paths | `jq`, `uv`, `pnpm`, a js-debug server, a Chromium-based browser, a `lsp-tooling/` folder (not bundled, M1), bash 4 or newer | L |
| 29 | First paragraph of `harness/project/AGENTS.md` | Papercuts log: a global file for anything that cost time (date, symptom, fix, project), checked first when tooling fails for an unknown reason | concept only (no file bundled, M3) | a shared file path | S |
| 30 | `harness/extensions/global/title.ts`, `harness/extensions/global/mode-presets.ts`, `harness/extensions/global/vibe-extra-tools.ts`, `rules/global/vibe-extra-tools.md`, `harness/global/TITLE_SYSTEM.md`, `harness/global/config.yml`, `automation/n8n/package.json`, `build/` | Conveniences and personal settings: session titles, terminal-key mode presets, vibe-mode tool list, model roles and UI settings, an empty n8n manifest, the PDF builder | skip. Read `harness/global/config.yml` only for model-role tiers and `advisor.reviewMode` | n/a | S |

### 1.2 Mining index (need -> read)
| You need | Read |
|---|---|
| A PR title and description standard | `skills/pr-creation/SKILL.md` (Title, Template A, Template B, Forbidden wording) |
| A ticket template for a Bug filed from a finding | `skills/pr-and-team-comms/SKILL.md` ("Filing a new bug from a finding") |
| A story contract format and its gate | `skills/story-refinement/SKILL.md` (Step 4 template), `skills/story-workflow/SKILL.md` (Step 0) |
| A spec format with tiers, waves, and delegation rules | `skills/ticket-triage/SKILL.md` (Tiers, Step 7 spec template) |
| Where a regression test goes and how to prove it | `skills/regression-test-placement/SKILL.md` (Placement table, Mutation check per stack) |
| Proof that a deploy contains a fix | `skills/tasks-deployed-to-qa/SKILL.md` (Step 5), `skills/deployed-version-check/SKILL.md` |
| Safe PR conflict resolution | `skills/merge-conflict/SKILL.md` |
| Review-thread triage and replies | `skills/pr-comments/SKILL.md` |
| A merge gate table | `skills/pr-merge/SKILL.md` (Step 2) |
| Service start, ports, cross-wiring, debug | `skills/service-startup-reference/SKILL.md`, `harness/extensions/project/services/plan.ts` |
| A secret scan with a smoke-testable config | `scripts/secret-scan.sh`, `scripts/gitleaks.toml`, `scripts/gitleaks-report.tmpl` |
| Wiki schema and log format | `vault/schema.md` |
| Unattended-job prompt design (guards, allowlists, stop rules) | `automation/board-ingest/prompt.md`, `automation/slack-ingest/prompt.md`, `automation/slack-ingest/run.sh` |
| A subagent definition with a strict return format | `agents/pr-security.md` |
| A UI flow contract and its runner | `skills/flow-schema/SKILL.md`, `agents/flow-runner.md` |
| Communication and honesty rules | `harness/global/APPEND_SYSTEM.md` |
| Tracker vocabulary and state ladders | `harness/project/AGENTS.md` (Vocabulary, Work item states), Section 5.2 |
| The triage profile contract | `skills/ticket-triage-profile/SKILL.md` |
| A way to test a script safely | `skills/task-branch-script-internals/SKILL.md` |
| Tool-call guard code | `harness/extensions/global/guardrails.ts`, `harness/extensions/project/no-parent-folder-guard.ts`, `harness/extensions/project/process-ownership-guard.ts` |

## 2. Pack manifest and install map

### 2.1 Layout and roles
```
handoff/
  README.md                  human-level index and install targets
  HANDOFF-FOR-HUMANS.pdf     the human handbook, built from build/parts
  HANDOFF-FOR-AGENTS.md      this file
  build/                     inputs for the human PDF (build.ts, style.css, handbook.html, parts/*.md). Not for agents
  skills/                    36 workflow and wiki skills (one folder each, SKILL.md)
    third-party/             3 upstream skills copied verbatim, plus CREDITS.md and LICENSE
  rules/global/ rules/project/   6 and 12 rule files
  commands/                  11 slash commands
  agents/                    4 subagent definitions
  harness/
    global/ project/         system-prompt add-ons, rule prose, config, advisors, approval rubrics
    extensions/global/ extensions/project/   TypeScript guards and tools
    mcp.template.json        MCP server template
  scripts/                   5 shell scripts, a secret-scan config, a report template
  automation/                board-ingest, slack-ingest, playwright helpers, n8n manifest (empty)
  vault/                     schema, index, log, templates, views, fictional examples
```

### 2.2 Install map
Paths in the OMP column are the ones the pack files themselves cite (for example `.omp/extensions/process-ownership-guard.ts`, `.omp/playwright/totp.mjs`, `.omp/board-ingest/prompt.md`). Keep them, or edit every citation. The Claude Code column is general knowledge of that harness, not content from the pack: verify against your version's documentation [INFERENCE].

| Pack group | OMP install target | Claude Code | Generic AGENTS.md harness |
|---|---|---|---|
| Project skills (all skills except `ticket-triage` and `wiki-*`) | `<tasks-root>/.omp/skills/<name>/` | `.claude/skills/<name>/` | `.agents/skills/<name>/` if the harness reads it, else keep as docs linked from `AGENTS.md` |
| `skills/ticket-triage/`, `skills/wiki-*` | `~/.omp/agent/skills/<name>/` | `~/.claude/skills/<name>/` | `~/.agents/skills/<name>/` |
| `skills/third-party/*` | `~/.agents/skills/<name>/` | `~/.claude/skills/<name>/` | `~/.agents/skills/<name>/` |
| `commands/*.md` | `<tasks-root>/.omp/commands/`; `triage.md` to `~/.omp/agent/commands/` | `.claude/commands/`; `triage.md` to `~/.claude/commands/` | none: document the entry prompts in `AGENTS.md` |
| `agents/*.md` | `<tasks-root>/.omp/agents/` | `.claude/agents/` (map `blocking` and the `@role` model aliases to your fields) | none: run each as a separate headless session with the same prompt |
| `rules/project/*.md` | `<tasks-root>/.omp/rules/` | fold into `CLAUDE.md` (or `.claude/rules/` if your version supports it) | sections of `AGENTS.md` |
| `rules/global/*.md` | `~/.omp/agent/rules/` | `~/.claude/CLAUDE.md` | user-level instruction file |
| `harness/project/AGENTS.md` | `<tasks-root>/.omp/AGENTS.md` (every skill cites `.omp/AGENTS.md`; OMP reads an `AGENTS.md` at the working root and `.omp/AGENTS.md` [INFERENCE]) | `CLAUDE.md` (or import `AGENTS.md`) | `AGENTS.md` at the working root |
| `harness/project/RULES.md` | `<tasks-root>/.omp/RULES.md` | `CLAUDE.md` section | `AGENTS.md` section |
| `harness/project/config.yml` | `<tasks-root>/.omp/config.yml` | `.claude/settings.json` (`permissions` allow, ask, deny; hooks for conditions) | the harness permission config |
| `harness/project/WATCHDOG.yml`, `harness/global/WATCHDOG.yml`, `harness/global/WATCHDOG.md` | `<tasks-root>/.omp/WATCHDOG.yml`, `~/.omp/agent/WATCHDOG.yml`, `~/.omp/agent/WATCHDOG.md` | no equivalent (2.4) | no equivalent |
| `harness/project/tool-call-auditor.md`, `harness/global/tool-call-auditor.md` | `<tasks-root>/.omp/tool-call-auditor.md`, `~/.omp/agent/tool-call-auditor.md` | a PreToolUse hook that calls a small model with this rubric [INFERENCE] | no equivalent |
| `harness/project/dap.json` | `<tasks-root>/.omp/dap.json` | no equivalent | none |
| `harness/global/APPEND_SYSTEM.md`, `harness/global/RULES.md` | `~/.omp/agent/APPEND_SYSTEM.md`, `~/.omp/agent/RULES.md` | `~/.claude/CLAUDE.md` | user-level instruction file |
| `harness/global/config.yml` | `~/.omp/agent/config.yml` (merge the keys you need; do not overwrite your own) | model roles become `model` fields in agent files | none |
| `harness/global/TITLE_SYSTEM.md` | `~/.omp/agent/TITLE_SYSTEM.md` | none | none |
| `harness/mcp.template.json` | `<tasks-root>/.omp/mcp.json` | `.mcp.json` | the harness MCP config |
| `harness/extensions/global/*` (and `lib/`) | `~/.omp/agent/extensions/` (keep `lib/` beside `advisor-gate.ts`) | hooks (2.4) | none |
| `harness/extensions/project/*` (and `services/`) | `<tasks-root>/.omp/extensions/` | hooks (2.4) | none |
| `scripts/*` (all 7 files together) | `<tasks-root>/` (`scripts/secret-scan.sh` looks for `gitleaks.toml` and `gitleaks-report.tmpl` beside itself) | same | same |
| `automation/board-ingest/`, `automation/slack-ingest/` | `<tasks-root>/.omp/board-ingest/`, `<tasks-root>/.omp/slack-ingest/` (the runners resolve the tasks root as two levels up) | a `claude -p` runner with a settings file or deny flags [INFERENCE] | any headless agent CLI |
| `automation/playwright/*` | `<tasks-root>/.omp/playwright/` (`harness/extensions/global/guardrails.ts` and `agents/flow-runner.md` cite this path) | same path; update the two citations | same |
| `vault/` | your Obsidian vault root (`<VAULT_ROOT>`), registered so `vault://wiki/` resolves | any folder; use file tools | any folder |

Tool-name spelling in approval and deny lists differs by harness. OMP uses `mcp__<server>_<tool>` with hyphens in the server name turned into underscores (for example `mcp__azure_devops_wit_work_item_write`). Claude Code spells MCP tools `mcp__<server>__<tool>` [INFERENCE]. Re-derive every key from the live tool list; never copy a key blindly.

### 2.3 Inventory by group

#### 2.3.1 Skills
Roles and triggers are in Section 10. Install scope below.

| Scope | Paths |
|---|---|
| Project (27, including `workflow-router` and `ticket-triage-profile`) | `skills/bug-workflow/SKILL.md`, `skills/checkmarx-handling/SKILL.md`, `skills/daily-work-poll/SKILL.md`, `skills/deployed-version-check/SKILL.md`, `skills/e2e-verification/SKILL.md`, `skills/flow-schema/SKILL.md`, `skills/merge-conflict/SKILL.md`, `skills/morning-brief/SKILL.md`, `skills/my-pr-status/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/pr-and-team-comms/SKILL.md`, `skills/pr-comments/SKILL.md`, `skills/pr-creation/SKILL.md`, `skills/pr-merge/SKILL.md`, `skills/pr-review/SKILL.md`, `skills/pr-security-gate/SKILL.md`, `skills/regression-test-placement/SKILL.md`, `skills/repo-onboarding/SKILL.md`, `skills/service-startup-reference/SKILL.md`, `skills/story-refinement/SKILL.md`, `skills/story-workflow/SKILL.md`, `skills/task-branch-script-internals/SKILL.md`, `skills/task-cleanup/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md`, `skills/ticket-bootstrap/SKILL.md`, `skills/ticket-triage-profile/SKILL.md`, `skills/workflow-router/SKILL.md` |
| Global (9: generic triage and the eight vault skills) | `skills/ticket-triage/SKILL.md`, `skills/wiki-comms/SKILL.md`, `skills/wiki-ingest/SKILL.md`, `skills/wiki-lint/SKILL.md`, `skills/wiki-meeting/SKILL.md`, `skills/wiki-query/SKILL.md`, `skills/wiki-spec/SKILL.md`, `skills/wiki-sync/SKILL.md`, `skills/wiki-task-loop/SKILL.md` |
| Extra skill files | `skills/pr-review/COMMENT-STYLE-NOTES.md` (comment-style lessons for review drafts), `skills/wiki-spec/SPEC.md` (the vault system spec: decision record, architecture, workflows, gates, setup) |
| Third-party (verbatim; MIT, see `skills/third-party/CREDITS.md` and `skills/third-party/LICENSE`) | `skills/third-party/grill-me/SKILL.md`, `skills/third-party/grilling/SKILL.md`, `skills/third-party/research/SKILL.md` |
| Third-party extra files | An `openai.yaml` interface stub in the `agents/` subfolder of all three: `skills/third-party/grill-me/agents/openai.yaml`, `skills/third-party/grilling/agents/openai.yaml`, `skills/third-party/research/agents/openai.yaml` |

#### 2.3.2 Rules
| File | Kind | Effect |
|---|---|---|
| `rules/global/BUG_FIXING.md` | doc rule (frontmatter `description` only) | Six-part bug-fixing guide and checklist |
| `rules/global/read-tool-first.md` | `alwaysApply` | `read`, `grep`, `glob` instead of shell reads; internal URLs only through `read` |
| `rules/global/no-redundant-reverify.md` | conditional on text and thinking, `interruptMode: never` | A clean reviewer or advisor verdict is terminal |
| `rules/global/no-emoji.md` | conditional on text (emoji pattern) | No emoji in replies or drafts |
| `rules/global/vault-writes-via-vault-uri.md` | conditional on `tool:write` and `tool:edit` paths | Vault pages only through `vault://`; schema first |
| `rules/global/vibe-extra-tools.md` | doc rule | How to configure the vibe-mode director's extra tools |
| `rules/project/azure-cli-fallback.md` | `alwaysApply` | CLI for login only, after an MCP failure; exception when no MCP action exists |
| `rules/project/tool-gotchas.md` | `alwaysApply` | Tool traps and their fixes |
| `rules/project/no-parent-folder-repo-access.md` | `alwaysApply` | Parent-folder and bare-repo ban; the guard enforces it |
| `rules/project/pr-thread-resolution.md` | conditional on the thread-write tool's `update_status` | Never resolve another person's thread. One exception: `pr-merge` closes `superseded` and approved chit-chat threads behind its combined ask |
| `rules/project/ado-ticket-voice.md` | conditional on text and the work-item write tool | Plain first-person ticket text |
| `rules/project/ado-area-path.md` | conditional on work-item create and update | Area path on every write (temporary-override template) |
| `rules/project/teardown-verification-tooling-after-pr.md` | conditional on PR creation | Close Playwright and stop verification services right after the PR is created |
| `rules/project/no-orphan-processes-after-use.md` | text-judged (`question` field) | Stop what you start; report the literal `lsof` result |
| `rules/project/services-via-services-tool.md` | conditional on `hub` and `bash` start patterns | Services only through the `services` tool |
| `rules/project/task-files-in-ticket-folder.md` | conditional on `/tmp` file writes | No scratch files in `/tmp` |
| `rules/project/py-runtime-assert.md` | conditional on `.py` edits | No `assert` for runtime invariants outside tests |
| `rules/project/py-log-exception.md` | conditional on `.py` edits | `logger.exception` inside `except` blocks |

#### 2.3.3 Commands
| File | Loads | Argument | Note |
|---|---|---|---|
| `commands/bug.md` | `workflow-router`, `ticket-bootstrap`, `bug-workflow` | Bug id | Posts the fixed PR-open line with no draft; any other Slack post needs a draft |
| `commands/story.md` | `workflow-router`, then `story-workflow` or `story-refinement` by state | Story id | Routes `Ready for Development or later` to Session B; how a resume passes the gate is open (X1) |
| `commands/triage.md` | `ticket-triage` | ticket id | Global command. Expects the Big-tier model and does not check it |
| `commands/comments.md` | `pr-comments` | PR number | The PR author picks the mode |
| `commands/conflict.md` | `merge-conflict` | PR number | |
| `commands/pr-merge.md` | `pr-merge` | optional PR number | No number runs the scan flow |
| `commands/pr-status.md` | `my-pr-status` | none | Output is the Step 4 block only |
| `commands/qa-deployed.md` | `deployed-version-check` | optional service | Empty scope means every repo |
| `commands/ado-review.md` | `pr-review` | PR number | |
| `commands/morning.md` | `morning-brief` | none | |
| `commands/cleanup.md` | `task-cleanup` | none | Runs `scripts/cleanup-task-folders.sh report` first |

#### 2.3.4 Agents
| File | Model field | Tools | Role |
|---|---|---|---|
| `agents/pr-security.md` | `anthropic/claude-sonnet-5:high`, `blocking: true` | read, grep, glob | Pre-PR security gate ruling; returns `VERDICT: clean` or numbered findings |
| `agents/flow-runner.md` | `@smol` | read, write, glob, bash, 11 Playwright tools (no `browser_close`) | Runs one flow, one env, one expect; writes only inside its run folder |
| `agents/error-detective.md` | `@task` | read, grep, glob | Correlates logs across services to prove or break a request chain |
| `agents/architect-reviewer.md` | `@slow` | read, grep, glob | Third review lane in `pr-review`: boundaries and contracts |

#### 2.3.5 Harness prompt, config, and policy files
| File | Role |
|---|---|
| `harness/global/APPEND_SYSTEM.md` | System-prompt add-ons: Knowledge limits, Wiki, Writing standard (ASD-STE100), Communication, Session close, Context clear |
| `harness/global/RULES.md` | Sticky invariants: `raw/` and `log.md`, ask before PR, drafts, brevity, `.env.local` management, `*****`, `vault://` addressing |
| `harness/global/config.yml` | Global settings: model roles, advisor mode, stop-detection off, `toolApprovalConditions` fallbacks, `vibeExtraTools`, personal UI settings (E7) |
| `harness/global/WATCHDOG.yml` | Global advisors: `default` and `WikiScribe` |
| `harness/global/WATCHDOG.md` | Shared advisor rules: silence means fine, scope precedence, ASD-STE100, tool choice |
| `harness/global/TITLE_SYSTEM.md` | Prompt for `/title` session names |
| `harness/global/tool-call-auditor.md` | Auditor rubric: Playwright snippets and work-item comments |
| `harness/project/AGENTS.md` | Constants file (Section 3 values) |
| `harness/project/RULES.md` | Project gate prose and exception list |
| `harness/project/config.yml` | `tools.approval` denies, `git.enabled: false`, `vibeExtraTools`, `toolApprovalConditions` for work-item writes |
| `harness/project/WATCHDOG.yml` | Project advisors: `PRSecurity` (disabled until `pr-review` loads) and `default` (watch list) |
| `harness/project/tool-call-auditor.md` | Project addition to the auditor rubric (session cookies, tokens, headers are UNSAFE) |
| `harness/project/dap.json` | Default `debugpy` adapter |
| `harness/mcp.template.json` | MCP server template (`azure-devops`, `azure-mcp`, `playwright`, `slack`) |

#### 2.3.6 Extensions
| File | Scope | What it does |
|---|---|---|
| `harness/extensions/global/guardrails.ts` | global | Hard-blocks key, credential, secrets-file, and browser-profile references. Allows dotenv reads with values masked as `*****` and blocks writing the mask back. Prompts for `env` and `printenv`, Python environment reads, tampering with the TOTP helper, and overwriting an unmanaged dotenv file. Refuses `run_code_unsafe` with `filename`. Documented as a guardrail, not a sandbox |
| `harness/extensions/global/tool-approval-gate.ts` | global | Applies `toolApprovalConditions` (first matching rule decides, `fallback` otherwise). Runs the auditor model review for governed tools. Fails closed for three governed tools |
| `harness/extensions/global/move-session.ts` | global | `move_session` tool (launch directory or a direct child only; refused from subagents). Returns to the root after clear or compact |
| `harness/extensions/global/end-session.ts` | global | `end_session` tool. Drains advisors, then exits from the `turn_end` hook. Needs a UI |
| `harness/extensions/global/clear-context.ts` | global | `clear_context` tool. Defers to an idle point, drains advisors first |
| `harness/extensions/global/compact-context.ts` | global | `compact_context` tool. Same deferral |
| `harness/extensions/global/advisor-gate.ts` | global | Wakes dormant advisors when a skill that lists them is read (frontmatter `advisors:` or an `advisor-gate.yml` binding), on `/skill:<name>`, or on `/advisors add` |
| `harness/extensions/global/advisor-drain.ts` | global | Holds the turn open until advisors finish, so an in-flight vault write is not lost (25 s margin under the 30 s hook cap) |
| `harness/extensions/global/lib/advisor-config-compat.ts` | global | Local port of advisor-roster discovery, because deep package imports fail in the compiled binary |
| `harness/extensions/global/mode-presets.ts` | global | One key sets model plus mode (plan, vibe, goal). Terminal-specific key bindings (E8) |
| `harness/extensions/global/vibe-extra-tools.ts` | global | Re-adds tools named in `vibeExtraTools` to the vibe-mode director |
| `harness/extensions/global/title.ts` | global | `/title` command. Disabled in the shipped `harness/global/config.yml` (E9) |
| `harness/extensions/project/no-parent-folder-guard.ts` | project | Blocks tool calls whose resolved paths enter the workspace parent outside `tasks/`. Lexical; parses bash to depth 3; set `PROJECT_DIR` |
| `harness/extensions/project/process-ownership-guard.ts` | project | Ledger of processes this OMP process started. Blocks stop, kill, and restart of anything else, and `pkill`, `killall`, `xargs kill`, and `kill` without a literal PID |
| `harness/extensions/project/services/index.ts` | project | The `services` tool: start, stop, restart, status, logs for five services. Writes to the ownership ledger. Error codes (`port_in_use`, `health_failed`, ...) |
| `harness/extensions/project/services/plan.ts` | project | Service table (ports, debug ports, start order, sibling wiring, readiness patterns). Edit it for your repos |
| `harness/extensions/project/services/plan.test.ts` | project | Tests for the planning logic |

#### 2.3.7 Scripts
| File | Role |
|---|---|
| `scripts/setup-task-branch.sh` | Create or reuse a branch worktree in every `*-bare` repo, link `.env`, link each worktree into `<TYPE>-<ID>-<summary>`. `--pr <repo> [--target-branch <b>] <src> <folder>` for reviews |
| `scripts/setup-task-lsp.sh` | Link the shared `.omp`, install each repo, install pinned LSP tooling, write `lsp.json`, `dap.json`, `pyrightconfig.json`, a root marker |
| `scripts/self-review.sh` | Write the diff to `review/self-<repo>.diff`; print files changed, new code comments, env and secret files, dependency changes, secrets in content. Exit 0 clean, 1 findings, 2 usage or scan error |
| `scripts/secret-scan.sh` | Run `gitleaks` over commits since the merge base, staged, unstaged, and untracked files; write redacted TSV reports. Exit 0 clean, 1 findings or scan error, 2 usage error (including missing `gitleaks`) |
| `scripts/gitleaks.toml` | Scan config (`useDefault = true`, no allowlist yet). Add rule-scoped allowlist blocks only (P8) |
| `scripts/gitleaks-report.tmpl` | Report template: tab-separated RuleID, File, StartLine, Commit |
| `scripts/cleanup-task-folders.sh` | `report`, `clean`, `clean-worktree`, `strays`, `prune`; every mutating subcommand is a dry run without `--apply`. When it removes a worktree it also removes the containers, labelled volumes, networks, and locally built images of every compose project whose working directory is that worktree (skipped silently when Docker is missing or down) |

#### 2.3.8 Automation
| File | Role |
|---|---|
| `automation/README.md` | What each piece does, inputs, outputs, files copied and skipped, placeholders to fill |
| `automation/board-ingest/run.sh` | Cron runner: one headless `omp -p` call with the overlay, tools limited to read, write, edit, grep, glob, todo |
| `automation/board-ingest/prompt.md` | 12-step unattended prompt: guard, two WIQL queries, proposal table, two owned notes, mirror fields, log entry, write allowlist, stop rules |
| `automation/board-ingest/overlay.yml` | Config overlay: advisor and memory off, eight tracker, chat, PR, and pipeline write tools denied |
| `automation/board-ingest/install.sh`, `automation/board-ingest/uninstall.sh` | Add or remove only this job's crontab line (default weekdays 10:15) |
| `automation/slack-ingest/run.sh` | Cron runner with gap-fill backfill (oldest first, cap 21 days), mode-600 secrets check |
| `automation/slack-ingest/prompt.md` | 8-step unattended prompt: guard, read channels, select durable facts, raw file, source page, inbox tasks, write allowlist, log entry |
| `automation/slack-ingest/overlay.yml` | Config overlay: six write tools denied (E4) |
| `automation/slack-ingest/install.sh`, `automation/slack-ingest/uninstall.sh` | Add or remove the cron line (default daily 08:30; E4) |
| `automation/playwright/totp.mjs` | RFC 6238 code generator; reads the seed from the shared secrets file; never prints the seed |
| `automation/playwright/totp.test.mjs` | `node --test` suite with RFC 6238 vectors |
| `automation/playwright/config.json`, `automation/playwright/windows-client-hints-init.js` | Playwright MCP config with a spoofed Windows Chrome user agent and client hints (E5) |
| `automation/n8n/package.json` | Empty community-node manifest. Nothing is automated here |

#### 2.3.9 Vault
| Path | Role |
|---|---|
| `vault/schema.md` | The contract: tree, naming rules, field tables for 8 page types, log format, hard invariants, view catalog |
| `vault/index.md`, `vault/log.md` | Catalog and append-only log. Their wikilinks omit the `examples/` prefix, so move `vault/examples/<type>/` up one level to make them resolve, or replace both files |
| `vault/templates/source.md`, `vault/templates/note.md`, `vault/templates/org.md`, `vault/templates/project.md`, `vault/templates/person.md`, `vault/templates/decision.md`, `vault/templates/meeting.md`, `vault/templates/task.md` | One template per page type |
| `vault/views/sources.base`, `vault/views/projects.base`, `vault/views/people.base`, `vault/views/decisions.base`, `vault/views/meetings.base`, `vault/views/tasks.base` | Obsidian Bases saved queries |
| `vault/examples/orgs/AcmeGrid.md`, `vault/examples/orgs/Northwind.md`, `vault/examples/orgs/Personal.md` | Fictional client, consultancy, and personal org pages |
| `vault/examples/projects/meter-api.md`, `vault/examples/projects/web-app.md` | Fictional project pages |
| `vault/examples/tasks/fix-meter-reading-rounding.md`, `vault/examples/tasks/add-retry-to-export-job.md`, `vault/examples/tasks/update-readme-run-steps.md` | Fictional task pages |
| `vault/examples/meetings/2026-03-04-platform-standup.md`, `vault/examples/raw/2026-03-04-platform-standup.md` | Fictional meeting page and its immutable raw transcript |
| `vault/examples/people/jamie-author.md`, `vault/examples/people/taylor-techlead.md`, `vault/examples/people/morgan-qatester.md`, `vault/examples/people/casey-productowner.md` | Fictional person pages (role names only) |
| `vault/examples/decisions/2026-03-03-store-readings-as-integers.md`, `vault/examples/decisions/2026-03-09-store-readings-as-decimals.md` | A decision and the decision that supersedes it |
| `vault/examples/notes/service-registry.md`, `vault/examples/notes/2026-03-13-lint-report.md` | A reusable-fact note and a lint report |
| `vault/examples/sources/2026-03-05-slack-reading-precision-thread.md`, `vault/examples/sources/2026-03-06-vendor-meter-protocol-guide.md`, `vault/examples/raw/2026-03-06-vendor-meter-protocol-guide.md` | Fictional source pages and the raw original |

#### 2.3.10 Top level and build
`README.md` (index), `HANDOFF-FOR-AGENTS.md` (this file), `HANDOFF-FOR-HUMANS.pdf` (the human handbook). `build/build.ts` and `build/style.css` are the PDF builder (`cd build && bun build.ts`; it needs Bun and a Chromium-based browser). `build/handbook.html` is the intermediate output. `build/parts/00-cover.md`, `build/parts/01-foundations.md`, `build/parts/02-making.md`, `build/parts/03-shipping.md`, `build/parts/04-wisdom.md`, and `build/parts/05-dictionary.md` are the handbook source. None of `build/` is agent input.

### 2.4 Features with no equivalent elsewhere, and fallbacks
| OMP feature (pack paths) | Used for | Fallback |
|---|---|---|
| `vault://` URIs and `?op=` queries (`rules/global/vault-writes-via-vault-uri.md`, `skills/wiki-*`) | Typed wiki access with snapshot tags | Treat the vault as a plain Markdown folder edited with file tools. Keep the schema, naming, and log rules. Drop the "never use the filesystem path" rule and the `[vault://...#TAG]` edit header. An Obsidian or filesystem MCP server can add tool-level scoping |
| `skill://<name>` reads in commands, agents, and skills | Load a skill on demand | Replace with "load the `<name>` skill" or the file path |
| Advisors (`harness/*/WATCHDOG.yml`, `advisor-gate.ts`, `advisor-drain.ts`) | Second-model transcript review and the vault scribe | (a) a session-end hook that launches a headless reviewer over the transcript; (b) turn each watch-list line into a checklist in the PR template or a review command; (c) run the `wiki-*` skills by hand at ticket end |
| Stream-rule matching (`condition`, `scope`, `interruptMode` in `rules/`) | Inject a reminder when text or a tool call matches | Put the rule body in the instruction file. Enforce hard guarantees with tool-call hooks. The author removed stream-level action gates because they misfired (H1) |
| Tool-call extensions (`guardrails.ts`, `no-parent-folder-guard.ts`, `process-ownership-guard.ts`, `tool-approval-gate.ts`) | Deterministic blocks on final tool arguments | Reimplement the same checks as pre-tool hooks that can veto a call. Same logic, different API [INFERENCE: confirm your harness hook can block] |
| `services` tool (`harness/extensions/project/services/`) | Start, wire, health-check, and stop local services with an ownership ledger | A shell script or small MCP server with the same contract: port check, sibling wiring env, log-regex readiness, ledger, stop by process group. Add a hook that denies `kill` without a literal PID this session owns |
| `move_session`, `clear_context`, `compact_context`, `end_session` | Agent-driven session control | Tell the human the command to type. Start every session at the tasks root. Give subagents absolute task-folder paths (the pack already requires them) |
| `ask` tool (multi-choice prompt) | Combined approvals in `pr-merge` and others | Ask in chat with lettered options. Accept single-token answers |
| `task` batches with built-in agent types (`scout`, `reviewer`, `security-reviewer`, `task`, `sonic`) and model roles (`@slow`, `@task`, `@smol`) | Parallel workers and read-only lanes | Define each used type once as an agent file with the same name and tool allowlist, or inline the brief into a headless run |
| `debug` and `lsp` tools | Debugger-based root cause, symbol navigation | Use CLI debuggers or logs. `skills/bug-workflow/SKILL.md` allows skipping its debugger step when request and response evidence alone proves the root cause, if the design doc says so |
| `omp -p --config <overlay>` headless runs (`automation/*/run.sh`, `overlay.yml`) | Unattended jobs with write tools denied | Same two-barrier design: a deny list in the runner config plus a prompt allowlist, plus guard lines for idempotency |
| `hub` and `omp ps` | Process supervision cited by `harness/extensions/project/process-ownership-guard.ts` and the rules | Drop the references |
| Status line, `mode-presets`, `title`, `vibe-extra-tools` | UI conveniences | Skip |

## 3. Placeholder table

Every `<UPPER_CASE>` token in the pack (grep `<[A-Z_]+>`), grouped. "Find the value" names a tool call first, then a human question. A token inside a family row (for example `<REPO_ID_*>`) is listed in full in the first cell. Never put a real value in a file the human will commit if the pack says the value belongs in the vault or an environment variable.

### 3.1 Install-time placeholders (you fill them)
| Placeholder | Meaning | Used in | Find the value |
|---|---|---|---|
| `<PROJECT>` | Workspace folder name under `~/work`. Also the `PROJECT_DIR` constant in the parent-folder guard | 30 files, including `harness/extensions/project/no-parent-folder-guard.ts`, `harness/project/AGENTS.md`, `harness/project/RULES.md`, `scripts/cleanup-task-folders.sh`, `scripts/secret-scan.sh`, `scripts/self-review.sh`, most skills | You choose it. It must equal the folder name under `~/work` |
| `<CLIENT>`, `<EMPLOYER>`, `<PRODUCT>` | Client organization, the consultancy that employs the author, the assistant product the platform builds | `harness/project/AGENTS.md`, `automation/README.md`, `automation/slack-ingest/run.sh` (`<CLIENT>` in the channel comment), `skills/e2e-verification/SKILL.md` | Ask the human. Where a single org applies, delete the second name |
| `<YOUR_EMAIL>`, `<YOUR_DISPLAY_NAME>`, `<YOUR_EMAIL_ESCAPED>` | The author's tracker identity. A PR is the author's when `createdBy.uniqueName` equals the email. The escaped form is the regex form used by `valueMatches` | `harness/project/AGENTS.md`, `harness/project/config.yml`, `skills/merge-conflict/SKILL.md`, `skills/pr-comments/SKILL.md`, `skills/pr-merge/SKILL.md`, `skills/service-startup-reference/SKILL.md`, `automation/board-ingest/prompt.md` | Ask the human. Confirm with `core_get_identity_ids`. Escape `.` and `+` for the regex form |
| `<TECH_LEAD>`, `<TECH_LEAD_EMAIL>`, `<TEAMMATE_1>`, `<TEAMMATE_1_EMAIL>`, `<TEAMMATE_2>`, `<TEAMMATE_2_EMAIL>`, `<TEAMMATE_3>`, `<TEAMMATE_3_EMAIL>`, `<IDENTITY_ID_1>`, `<IDENTITY_ID_2>`, `<IDENTITY_ID_3>`, `<IDENTITY_ID_4>`, `<REVIEWER_A>`, `<REVIEWER_B>`, `<REVIEWER_C>`, `<REVIEWER_D>`, `<AUTHOR>`, `<AUTHOR_IDENTITY_ID>` | The four standing optional reviewers, their tracker identity ids, and a per-repo snapshot of reviewers the branch policy already requires | `skills/pr-creation/SKILL.md` ("Standing optional reviewers"); `<TECH_LEAD>` also in `harness/project/AGENTS.md` | Emails from the human. Ids from `core_get_identity_ids` by email (the skill warns an email is not always spelled like the display name). Required reviewers from the branch-policy command in the skill. The table is a snapshot: the policy is the authority |
| `<ADO_ORG>` | Azure DevOps organization. Launch argument of the tracker MCP server | 14 files, including `harness/mcp.template.json`, `rules/project/tool-gotchas.md`, `rules/project/ado-area-path.md`, `automation/board-ingest/run.sh`, `automation/board-ingest/prompt.md` | The organization segment of any tracker URL. Ask the human |
| `<ADO_PROJECT>` | Tracker project. Passed explicitly on every work-item call | 18 files, including `harness/project/AGENTS.md`, `skills/checkmarx-handling/SKILL.md`, `skills/daily-work-poll/SKILL.md`, `skills/deployed-version-check/SKILL.md`, `automation/board-ingest/prompt.md` | `core_list_projects` |
| `<ADO_PROJECT_URL_ENCODED>` | URL-encoded project name (a space becomes `%20`; never un-encode it) | `skills/pr-and-team-comms/SKILL.md`, `skills/my-pr-status/SKILL.md`, `automation/board-ingest/prompt.md`, `automation/README.md` | Encode `<ADO_PROJECT>`. Compare with `webUrl` from `repo_repository` `get` |
| `<AREA_PATH>`, `<PREVIOUS_AREA_PATH>` | Area path set on every work-item write. The rule file holds a current value and a previous value (a temporary board override) | `rules/project/ado-area-path.md` | `System.AreaPath` of an existing item via `wit_work_item` `get`. Decide whether you need the override mechanism (E13) |
| `<AREA_PATH_1>`, `<AREA_PATH_2>` | The two board area paths the board job scopes its WIQL query to | `automation/board-ingest/prompt.md`, `automation/README.md` | Same call. Ask which boards the team owns |
| `<STANDARDS_REPO>` | Tracker repo that holds the Git and PR standards | `harness/project/AGENTS.md`, `skills/pr-creation/SKILL.md`, `skills/pr-and-team-comms/SKILL.md` | `repo_repository` `list`. If none exists, delete the references and keep the rules inline |
| `<REPO_ID_WEB_APP>`, `<REPO_ID_DATA_MCP>`, `<REPO_ID_ORCHESTRATOR>`, `<REPO_ID_MEDIA_MCP>`, `<REPO_ID_FILE_GATEWAY>`, `<REPO_ID_INFRA>` | Repo GUIDs. PR creation needs the GUID, not the name | `skills/pr-creation/SKILL.md` ("Mechanics") | `repo_repository` `list`. The skill says fetch once and cache in the task's `plan/` folder. Never hard-code another team's |
| `<ADO_RESOURCE_ID>` | The public Azure DevOps resource application id used by `az account get-access-token --resource` | `rules/project/tool-gotchas.md` | Microsoft's public documentation. Not a secret |
| `<PIPELINE_ID>` | Pipeline definition ids: dev API e2e regression, per-repo scan pipelines, deploy pipelines | `harness/project/AGENTS.md`, `skills/checkmarx-handling/SKILL.md`, `skills/deployed-version-check/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/workflow-router/SKILL.md` | `pipelines_definition` `list` by name and repository. Confirm the trigger by reading the pipeline YAML. The skills say to keep ids in project config, not in the pack |
| `<E2E_PIPELINE_ID>` | The API end-to-end regression pipeline | `skills/regression-test-placement/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/service-startup-reference/SKILL.md` | Same call |
| `#<team-channel>` | Default Slack channel for the PR-open line and review asks | `harness/project/AGENTS.md`, `skills/pr-and-team-comms/SKILL.md`, `skills/bug-workflow/SKILL.md`, `skills/story-workflow/SKILL.md`, `skills/my-pr-status/SKILL.md` | Slack `channels_list` or `channels_me`. Ask which channel is the default |
| `#<tech-channel>`, `#<all-teams-channel>` | Engineering-internal channel and a broad product-facing channel | `harness/project/AGENTS.md`, `skills/pr-and-team-comms/SKILL.md` | Same call |
| `#<team-channel-1>`, `#<team-channel-2>`, `#<team-channel-3>` | The channel list the Slack ingest reads | `automation/slack-ingest/run.sh` (`CHANNELS` array) | Must equal the `slack_channels` field of the client org page in the vault |
| `<QA_URL>`, `<DEV_URL>`, `<DEV_API_URL>` | Web-app and API URLs per environment (dev sits behind a private endpoint in the author's setup) | `harness/project/AGENTS.md`, `agents/flow-runner.md`, `skills/e2e-verification/SKILL.md`, `skills/post-merge/SKILL.md`, `README.md` | Ask the human or ops. `agents/flow-runner.md` ignores any caller value for QA and uses `<QA_URL>` |
| `<TEST_USER_EMAIL>` | The test user for local web-app login (a tenant the consultancy owns) | `harness/project/AGENTS.md` | Ask the human. Credentials only by key name in the Playwright secrets file |
| `<SUBSCRIPTION_ID>`, `<QA_SUBSCRIPTION_NAME>`, `<REGION>`, `<RESOURCE_GROUP_ORCHESTRATOR_QA>`, `<APP_SERVICE_ORCHESTRATOR_QA>`, `<RESOURCE_GROUP_MEDIA_MCP_QA>`, `<APP_SERVICE_MEDIA_MCP_QA>`, `<RESOURCE_GROUP_DATA_MCP_QA>`, `<APP_SERVICE_DATA_MCP_QA>`, `<RESOURCE_GROUP_FILE_GATEWAY_QA>`, `<APP_SERVICE_FILE_GATEWAY_QA>`, `<RESOURCE_GROUP_WEB_APP_QA>`, `<APP_SERVICE_WEB_APP_QA>` | Cloud subscription and App Service names for the live-config check | `skills/deployed-version-check/SKILL.md` | Azure MCP `subscription_list`, `group_list`, `group_resource_list`. Keep real ids on a vault project page for the infrastructure repo, never in commands or files (`rules/project/azure-cli-fallback.md`) |
| `<TIMEZONE>` | Day boundary for the Slack ingest prompt (the runners also read `INGEST_TZ`, default UTC) | `automation/slack-ingest/prompt.md`, `automation/README.md` | Ask the human |
| `<VAULT_ROOT>` | Filesystem path of the vault | `harness/global/APPEND_SYSTEM.md`, `rules/global/vault-writes-via-vault-uri.md` | Where Obsidian registers the vault. The runners hard-code `<VAULT_ROOT>` in `VAULT_DIR` (E4); set it to your vault path |
| `<ENV_VAR_NAME_HOLDING_BASE64_PAT>`, `<ENV_VAR_NAME_HOLDING_SLACK_XOXP_TOKEN>`, `<PATH_TO_E2E_SECRETS_FILE>` | Names of two shell variables and a file path in the MCP template. The value in an `env` block is the variable NAME, not the secret | `harness/mcp.template.json` | You choose the names. Export the values before launching the harness. Never put a value in the file |
| `<PLACEHOLDER>` | The generic marker in the template's notes ("replace every `<PLACEHOLDER>`") | `harness/mcp.template.json`, `README.md` | n/a |
| `<YYYY-MM-DD>` (form) | `CRON_INSTALLED`, the date the Slack cron first ran. Backfill never reaches earlier | `automation/slack-ingest/run.sh`, `automation/README.md` | The date you install the cron |

### 3.2 Repo-role tokens (hard-coded topology)
The skills and tools assume this repo set. If the human's system differs, generalize the files below or map the human's repos onto these roles.

| Role | Meaning | Local port, debug port | Hard-coded in |
|---|---|---|---|
| `orchestrator` | Backend API that runs the LLM agent; needs a database | 8000, 5678 | `harness/extensions/project/services/plan.ts`, `scripts/setup-task-lsp.sh`, `skills/service-startup-reference/SKILL.md`, `skills/regression-test-placement/SKILL.md`, `skills/e2e-verification/SKILL.md`, `skills/pr-creation/SKILL.md` |
| `media-mcp` | MCP server that makes images, decks, and Word files | 8001, 5680 | same files |
| `data-mcp` | MCP server that wraps public data APIs | 8002, 5679 | same files |
| `file-gateway` | Proxy to blob storage behind identity-provider auth | 9000, 5681 | same files |
| `web-app` | React and Vite front end | 5173, none | same files, plus `skills/flow-schema/SKILL.md`, `agents/flow-runner.md` |
| `infra` | Terraform only: no local start, no local test | none | `harness/project/AGENTS.md`, `skills/pr-creation/SKILL.md`, `skills/my-pr-status/SKILL.md` |
| `legacy-agent` | Being retired; standing exclusion | none | `scripts/setup-task-branch.sh` (`excluded_repos`), `harness/project/AGENTS.md`, `harness/project/RULES.md`, `skills/ticket-bootstrap/SKILL.md` |
| `other-api`, `analytics`, `e2e-suite` | Out of scope unless a ticket names them | none | `harness/project/AGENTS.md` (out-of-scope list) |

Other files that name the roles: `skills/deployed-version-check/SKILL.md`, `skills/merge-conflict/SKILL.md`, `skills/checkmarx-handling/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/ticket-bootstrap/SKILL.md`, `skills/my-pr-status/SKILL.md`. `skills/merge-conflict/SKILL.md` and `skills/my-pr-status/SKILL.md` loop over a fixed repo list, so a different count needs an edit.

### 3.3 Fixed-name variables and secret-file keys
These are names, not values. Rename them only if you edit every file that cites them.

| Name | Meaning | Cited in |
|---|---|---|
| `CLIENT_AZURE_TENANT_ID`, `CLIENT_AZURE_SUB_ID_AI_DEV` | Shell variables read by the `az login --tenant ... --subscription ...` fallback. Values come from the vault infrastructure project page | `rules/project/azure-cli-fallback.md`, `harness/mcp.template.json`, `skills/pr-merge/SKILL.md` |
| `CLIENT_AZURE_PAT` | Base64 of `user:pat`, a ready-made Basic credential. Send as `Authorization: Basic $CLIENT_AZURE_PAT`, not with `curl -u`. Never print it | `harness/project/AGENTS.md`, `automation/board-ingest/run.sh` (refuses to run without it) |
| `CLIENT_AZURE_DEVOPS_ORG` | Default organization for the board runner | `automation/board-ingest/run.sh`, `automation/README.md` |
| `PERSONAL_ACCESS_TOKEN` | The variable the tracker MCP server reads. In the template its value is the NAME of the shell variable that holds the base64 PAT | `harness/mcp.template.json` |
| `SLACK_MCP_XOXP_TOKEN`, `SLACK_MCP_ADD_MESSAGE_TOOL` | Slack MCP user token, and the switch that registers the write tool (leave unset for read-only) | `harness/mcp.template.json`, `automation/slack-ingest/run.sh` |
| `TEST_USER_USERNAME`, `TEST_USER_PASSWORD`, `TEST_USER_TOTP_SECRET` | Keys in the shared test-credential file (a gitignored dotfile at the tasks root; its pattern is in `HARD_BLOCKED_PATTERNS` of `harness/extensions/global/guardrails.ts`). The agent types only the first two key names. The TOTP seed is read only by the helper | `agents/flow-runner.md`, `harness/mcp.template.json`, `automation/playwright/totp.mjs`, `automation/README.md` |
| `INGEST_TZ`, `MAX_BACKFILL_DAYS`, `CRON_INSTALLED`, `SECRETS_FILE` | Runner settings: day boundary, backfill cap (21), first-run date, path of the secrets file (must be mode 600) | `automation/slack-ingest/run.sh`, `automation/board-ingest/run.sh`, `automation/README.md` |
| `ENV=local` | Orchestrator local mode that enables the fake-auth bypass | `skills/service-startup-reference/SKILL.md`, `harness/extensions/project/services/plan.test.ts` |
| `AGENT_MCP_IMAGE_GENERATION_URL`, `AGENT_MCP_DATA_URL`, `VITE_ORCHESTRATOR_BASE_URL`, `VITE_FILES_BASE_URL`, `VITE_OIDC_REDIRECT_URI`, `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`, `VITE_DEV_HTTPS` | Sibling-wiring variables the `services` tool sets. Exact prefixed names matter: a wrong name is accepted and ignored (S5). Rename them to the names your orchestrator's settings class reads | `harness/extensions/project/services/plan.ts`, `skills/service-startup-reference/SKILL.md` |
| `CHROME_PATH` | Browser path for the PDF builder | `README.md` |

### 3.4 Runtime tokens (the agent fills them per task; do not replace at install)
| Token | Meaning | Where |
|---|---|---|
| `<NUM>`, `<ID>`, `<TYPE>`, `<TICKET>` | Ticket number, ticket id, ticket type prefix (`BUG`, `STORY`, `PR-REVIEW`, `RESEARCH`), ticket label | `harness/project/RULES.md`, `scripts/setup-task-branch.sh` (duplicate-folder family `<TYPE>-<ID>-`), `skills/pr-security-gate/SKILL.md`, `skills/my-pr-status/SKILL.md` |
| `<PRID>` | PR number rendered as a link in the PR-open Slack line | `skills/pr-and-team-comms/SKILL.md` |
| `<TASK>` | Task folder path in a `services` call example | `skills/service-startup-reference/SKILL.md` |
| `<ABS>` | Absolute path of the task folder, required for redirects written from inside a repo symlink | `skills/merge-conflict/SKILL.md`, `skills/pr-comments/SKILL.md`, `skills/pr-merge/SKILL.md` |
| `<NL>` | A literal newline named in a code comment | `harness/extensions/global/guardrails.ts` |
| `@@RUN_DATE@@`, `@@COVERED_DATE@@`, `@@CHANNELS@@` | Substituted by the runner scripts into the prompt before the headless call | `automation/board-ingest/run.sh`, `automation/board-ingest/prompt.md`, `automation/slack-ingest/run.sh`, `automation/slack-ingest/prompt.md` |
| lowercase tokens (`<repo>`, `<task>`, `<src>`, `<target>`, `<pr>`, `<n>`, `<slug>`, `<branch>`, `<id>`, `#<id>`) | Per-run arguments inside commands and skills | all skills |

### 3.5 Resolve placeholders in this order
1. Identity and org: `<YOUR_EMAIL>`, `<ADO_ORG>`, `<ADO_PROJECT>` (human, then `core_list_projects`, `core_get_identity_ids`).
2. Repos: `repo_repository` `list` gives names and GUIDs for the `<REPO_ID_*>` family and the repo-role mapping (3.2).
3. Policies and reviewers: read the branch policy with the command in `skills/pr-creation/SKILL.md` (a sanctioned CLI read).
4. Pipelines: `pipelines_definition` `list`, then read each YAML for its trigger.
5. Chat: `channels_list` for the channel tokens.
6. Environments and test user: human only. Never ask for a secret value; ask for the key names and file path.
7. Cloud names: Azure MCP `subscription_list`, `group_list`, `group_resource_list`.
8. Record every resolved value in one place (the constants file `harness/project/AGENTS.md` copy, or a vault project page for ids the pack says to keep out of files). Mark open items `[INFERENCE]` or "ask".

## 4. Operating invariants

Each row is a MUST or NEVER rule of the workflow, with the reason and the pack file that holds it. "History" means the rule comes from an incident recorded in Section 7 and no shipped file states it (M6). Rule numbers (R1 and up) are for cross-reference only.

### 4.1 Workspace and session
| # | Rule | Reason | Source |
|---|---|---|---|
| R1 | MUST start the harness in the tasks root. Project config (MCP servers, rules, skills, commands, agents, extensions) loads from `<cwd>/.omp` only. The unattended runners `cd` there first | A session started in a repo worktree, or in a task folder without the `.omp` link, silently loses the tracker, chat, and browser servers and the deny rules | `harness/project/RULES.md`, `automation/board-ingest/run.sh` |
| R2 | MUST call `move_session` into the ticket's task folder (found with `glob` on `*-<NUM>-*`) before any other work on that ticket. Never from a subagent. A story gets no folder before its contract gate passes | One task context per ticket. The move keeps the MCP servers because each task folder links the shared `.omp` | `harness/project/RULES.md`, `harness/extensions/global/move-session.ts` |
| R3 | NEVER touch the parent of the tasks root: bare clones, parent `.env` files, anything outside `tasks/`. Read code through task-folder symlinks and `git -C <task>/<repo>`. Read `main` through the dedicated `main` folder, and ask the human to create it if it does not exist | Isolation. The bare repos are shared by every ticket | `rules/project/no-parent-folder-repo-access.md`, `harness/extensions/project/no-parent-folder-guard.ts` |
| R4 | MUST create task folders, worktrees, and `.env` links only with `scripts/setup-task-branch.sh`, run from the tasks root. NEVER `mkdir` the folder first | A script prevents hand-rolled drift. Its duplicate guard stops one ticket from splitting across two folders | `skills/ticket-bootstrap/SKILL.md`, `scripts/setup-task-branch.sh` |
| R5 | NEVER remove a task-folder symlink, branch, or worktree the script created. Only a human instruction in the current session lifts this. `/cleanup` removes finished folders | An agent once deleted out-of-scope worktrees the author needed for testing (G3) | `harness/project/RULES.md`, `skills/ticket-bootstrap/SKILL.md` (Step 4) |
| R6 | NEVER write scratch, commit-message, or note files to `/tmp`. Keep them in the ticket folder | Artifacts must survive the session and be findable by the next one | `rules/project/task-files-in-ticket-folder.md` |
| R7 | MUST give an absolute path to any output written from inside a repo symlink, and give subagents absolute task-folder paths. NEVER use `../` from a repo | The shell resolves the symlink physically, so a relative redirect lands inside the bare repo (G5) | `skills/merge-conflict/SKILL.md` (Step 5), `skills/pr-review/SKILL.md` (Step 4), `harness/extensions/project/no-parent-folder-guard.ts` |
| R8 | MUST fetch with explicit refspecs (`+refs/heads/<b>:refs/remotes/origin/<b>`) in bare-clone worktrees. Use `--force-with-lease` only on your own amended branch after a proof that local equals origin. Confirm a push by re-reading the remote ref, not the exit code | Worktrees of a bare clone have no fetch refspec and no tracking ref for a new branch (G1). The ref re-read is history only (M6) | `scripts/self-review.sh`, `scripts/secret-scan.sh`, `skills/pr-comments/SKILL.md` (Step 7), `skills/task-branch-script-internals/SKILL.md` |

### 4.2 Tool use
| # | Rule | Reason | Source |
|---|---|---|---|
| R9 | MUST use `read`, `grep`, and `glob` for known paths and searches. NEVER `cat`, `ls`, `sed -n`, `head`, or shell `grep`. Use bash only for real programs | Agents default to shell reads at session start. An A/B run showed 2 shell `ls` calls before the rule and 0 after | `rules/global/read-tool-first.md` |
| R10 | NEVER `grep` the symlink path itself. Use a real subdirectory, or `git -C <task>/<repo> grep` for a whole repo | `grep` on the symlink returns a false "No matches found" (H11) | `rules/project/tool-gotchas.md` |
| R11 | MUST pass `timeout` (or a named start) for commands that can run over 300 s. MUST pass `project` on every work-item call | The shell cap kills long jobs. Omitting `project` makes the MCP ask a question that a headless run cannot answer (T2, H8) | `rules/project/tool-gotchas.md`, `automation/board-ingest/prompt.md` |
| R12 | MUST use the CLI (`az`) only to log in after an MCP failure, or when no mounted MCP tool exposes the action (confirm by tool name). Retry the MCP call once after login. NEVER make the CLI the workflow | MCP is the audited path. The CLI hides actions from the approval layer | `rules/project/azure-cli-fallback.md` |

### 4.3 Tracker
| # | Rule | Reason | Source |
|---|---|---|---|
| R13 | MUST re-fetch after every tracker write and check the field. A write response is not evidence | Writes "succeeded" with wrong data: stripped tags, an ignored transition flag, an optional-only reviewer (T1) | `harness/project/RULES.md`, `rules/project/tool-gotchas.md` |
| R14 | MUST move one neighbouring state per write, derive the ladder from the type-metadata call (`get_type`), and guard each write with a `/rev` test | A jump returned HTTP 400 although the matrix allows it (T3) | `harness/project/AGENTS.md`, `skills/morning-brief/SKILL.md`, `harness/project/config.yml` |
| R15 | NEVER write `Closed`, `Pending PO Review`, or `Accepted` | The tester closes bugs and the product owner accepts stories. The agent keeps no end-of-ladder authority | `harness/project/RULES.md`, `skills/pr-merge/SKILL.md`, `skills/morning-brief/SKILL.md` |
| R16 | MUST write `Resolved` (Bug) or `Ready for Test` (Story) only after every linked PR is Completed (abandoned PRs do not count), after re-fetching and recording the PR statuses. MUST write `Ready for Retest` or `In Test` only after the ancestry proof that the QA deploy holds the fix | Facts decide state moves. A PR merge never moves the item, even with the transition flag on | `harness/project/RULES.md`, `skills/tasks-deployed-to-qa/SKILL.md`, `skills/bug-workflow/SKILL.md` (Step 7) |
| R17 | NEVER overwrite the state of a returned bug (a bug whose state went back out of `Resolved`, `Ready for Retest`, or `Closed`). The tester's reason is in the comments | Bootstrap would have overwritten `Bug Test Failed` (T4) | `harness/project/AGENTS.md`, `skills/ticket-bootstrap/SKILL.md` (Step 1b), `skills/bug-workflow/SKILL.md` (Step 0) |
| R18 | MUST ask before commenting on or modifying a work item, except the listed no-prompt writes: area path, iteration path, assign to self, the `/rev` test, the state moves in R16, and writes a loaded skill directs. Comments pass the auditor review where the gate is installed | Prose and config must agree (H7). Comments have readers | `harness/project/RULES.md`, `harness/project/config.yml` |
| R19 | MUST write ticket text in plain first-person voice, name tags without angle brackets, append to (never replace) a human description with read-modify-write, and match the field's HTML or Markdown format | Report-style text reads as a third party. The MCP comment reader strips angle-bracket tags. A field update replaces the whole field | `rules/project/ado-ticket-voice.md`, `skills/story-refinement/SKILL.md` (Step 4), `skills/ticket-triage-profile/SKILL.md` |
| R20 | MUST set the area path on every work item created or edited, and re-fetch to confirm | Items outside the board are invisible to the team | `rules/project/ado-area-path.md` |

### 4.4 Git and PR
| # | Rule | Reason | Source |
|---|---|---|---|
| R21 | MUST keep one commit per repo per ticket. Fold late findings in with `git commit --amend` (own branch only). Write messages to a file and commit with `-F` | One coherent diff per repo keeps review small. Heredocs inside `-m` get mangled | `rules/global/BUG_FIXING.md` (section 3), `skills/bug-workflow/SKILL.md` (Step 5) |
| R22 | NEVER open a PR before its gate passes. Open it with no prompt once it does. Bug gate: reproduced, test failed before and passes after, mutation check, PR-build checks, live check, self-review clean, security gate passed. Story gate: the eight items in `plan/VERIFICATION.md`. One failure means no PR, or the draft path | A named evidence list replaced an always-yes prompt (C5) | `skills/bug-workflow/SKILL.md` (Step 5), `skills/story-workflow/SKILL.md` (Steps 5 and 6) |
| R23 | MUST run the pre-PR security gate before a new PR and before pushing your own code to an open PR. For any other push run `scripts/secret-scan.sh` and push only on `RESULT: clean` | Fails-open guards and committed secrets are cheaper to catch before review | `skills/pr-security-gate/SKILL.md`, `scripts/secret-scan.sh` |
| R24 | NEVER arm auto-complete until a required reviewer is marked (CLI), the PR is re-fetched, and the reviewer reads as required. Story Session B never arms it | `update_reviewers` adds optional reviewers only. Auto-complete set right after merged a PR unreviewed in about 15 seconds (P1) | `skills/pr-creation/SKILL.md` ("Auto-complete safety") |
| R25 | MUST link the work item and verify the relation by re-fetching the work item (`ArtifactLink`, name `Pull Request`, URL ending in the PR id) | The link policy blocks unlinked PRs. The link call's own response is not proof | `skills/pr-creation/SKILL.md` |
| R26 | NEVER mark another person's review thread Fixed, Closed, or WontFix. Push the fix, reply with the commit, leave it Active. Sole shipped exception: `pr-merge` closes `superseded` threads and chit-chat threads the author marks Close, inside its one combined ask (written into the rule file) | A thread was resolved on a teammate's comment and had to be reverted (P3) | `rules/project/pr-thread-resolution.md`, `skills/pr-comments/SKILL.md`, `skills/pr-merge/SKILL.md` |
| R27 | NEVER cast `Approved` or `ApprovedWithSuggestions` on someone else's PR before checking `autoCompleteSetBy` and the last blocking policy. Ask first if the vote would complete the PR | A vote satisfied the last policy and the owner's auto-complete merged at once (P2) | `harness/project/RULES.md`. `skills/pr-review/SKILL.md` does not repeat it (M6) |
| R28 | NEVER fetch, edit, push, merge, or abandon another person's branch. Act as a reviewer (read, draft, write a handoff doc) and post nothing without approval | Foreign branches are not the agent's to change | `harness/project/AGENTS.md`, `skills/pr-comments/SKILL.md`, `skills/merge-conflict/SKILL.md` |
| R29 | MUST resolve a PR conflict by merging the target into the branch. NEVER rebase. NEVER `--force` or `--force-with-lease` on the merge push. Regenerate lockfiles instead of hand-merging. Prove the PR's own change survived with a pre and post patch diff. Also NEVER stash during a merge (history only, G2, M6) | Rebase rewrites history others may hold. Hand-merged lockfiles rot. A merge once retired part of a shipped fix (P7) | `skills/merge-conflict/SKILL.md` |
| R30 | NEVER set `bypassPolicy`. `pr-merge` merges only the author's own PRs, only after fresh reads of every gate and one combined ask, and never a PR the human did not name or pick | A merge is hard to undo. A table from before a push is stale | `skills/pr-merge/SKILL.md` |
| R31 | MUST write PR titles as Conventional Commits with a ticket suffix, use template A or B, stay at 200 words or fewer, avoid the forbidden wording (no `Fixes N`, no suite-pass count, no "live-verified"), and include before and after images for visible changes | The description carries only what a reviewer cannot infer | `skills/pr-creation/SKILL.md` |
| R32 | MUST anchor review threads on changed lines of a changed file, name the problem, and strip incidental external data. The shipped sources disagree on adding a small fix block (X11) | A thread anchored outside the diff never rendered (P4) | `skills/pr-review/SKILL.md`, `skills/pr-review/COMMENT-STYLE-NOTES.md` |

### 4.5 Verification
| # | Rule | Reason | Source |
|---|---|---|---|
| R33 | MUST reproduce before designing a fix, at the true failure boundary, and confirm observable state (not "nothing crashed"). If the bug does not reproduce, stop and report the evidence | A dev proxy absorbed a client disconnect and gave false results (Q1) | `rules/global/BUG_FIXING.md` (section 1), `skills/bug-workflow/SKILL.md` (Step 1) |
| R34 | MUST write the failing test first, record its failing output, then make the smallest fix. MUST run the mutation check in the form chosen by `git diff --quiet HEAD -- <files>` | A test that passes without the fix guards nothing | `skills/regression-test-placement/SKILL.md`, `skills/bug-workflow/SKILL.md` (Steps 3 and 4) |
| R35 | MUST verify against the real dependency at least once. A passing mock is not proof. A fix that depends on library, framework, or proxy behavior needs a live run | A mock encoded a wrong abort contract and hid a production bug (Q1) | `rules/global/BUG_FIXING.md` (section 5), `skills/e2e-verification/SKILL.md` |
| R36 | MUST prove the served build before trusting a stack when several task stacks may run: `lsof` the listener, check the process cwd, `curl` one source module. A green health check is not proof | Cross-wired ports validated another branch's code (S1) | `skills/service-startup-reference/SKILL.md`, `skills/flow-schema/SKILL.md` (Step 3) |
| R37 | NEVER fabricate a bypass or read secrets to unblock a live test. Reuse an already-legitimate session, browser-side only. Otherwise state the blocker and fall back to static evidence | Secrets must not enter model context or artifacts | `rules/global/BUG_FIXING.md` (section 2), `skills/e2e-verification/SKILL.md` |
| R38 | MUST treat a worker's report as a claim: read the real diff, test file, and command output before any gate. Briefs are self-contained, one worker per repo, and say "report a blocker, do not fabricate" | "Done, tests pass" was forwarded unverified (A3) | `rules/global/BUG_FIXING.md` (section 6), `skills/story-workflow/SKILL.md` (Step 3) |
| R39 | MUST treat a clean reviewer or advisor verdict as terminal. Re-verify only for a new concrete concern or changed code | Approval triggered redundant re-reading and re-testing (A6) | `rules/global/no-redundant-reverify.md` |
| R40 | MUST run a flow's run 1 (`expect: broken`) on the pre-fix build before runs 2 and 3. The runner writes only inside its run folder | A flow that never returns `broken` on the broken build proves nothing | `skills/flow-schema/SKILL.md`, `agents/flow-runner.md` |
| R41 | MUST design each repo's fix with `file:line` citations, cross-check the designs, walk every deploy order for what a user sees, and spot-check citations against live source before implementing | A design can be right once both sides ship and broken in between | `rules/global/BUG_FIXING.md` (sections 3 and 4), `skills/bug-workflow/SKILL.md` (Step 3) |
| R42 | MUST run the repo's PR-build checks locally before every push, from the single table in `skills/service-startup-reference/SKILL.md`. Live verification adds to them and never replaces them | A story could pass its gate and still fail CI | `skills/service-startup-reference/SKILL.md`, `skills/story-workflow/SKILL.md` (Step 4) |
| R43 | Story Session B MUST trust only the ticket. Gate on a six-section contract with no `TBD`. On failure comment with each gap, move to `In Refinement`, and stop. Escalate by comment and `Blocked` when code contradicts the contract, scope widens, or a verification cannot run. NEVER reinterpret the contract or widen scope silently | The refusal is the quality mechanism. The contract is the spec | `skills/story-workflow/SKILL.md` (Step 0, Escalation rule), `skills/story-refinement/SKILL.md` |

### 4.6 Services and processes
| # | Rule | Reason | Source |
|---|---|---|---|
| R44 | MUST start, stop, and inspect the five local services only through the `services` tool, from the main agent. NEVER dispatch a subagent to start one | A service a subagent starts stops when that subagent ends. Hand-started services cross-wire | `rules/project/services-via-services-tool.md`, `harness/extensions/project/services/index.ts` |
| R45 | NEVER stop, kill, or restart a process this OMP session did not start, even with the human's live authorization. Pick another port or ask the human. A `process-ownership-guard:` block is final. NEVER `pkill`, `killall`, `xargs kill`, or `kill` without a literal PID | A lifecycle agent killed a foreign process. Prose alone did not hold (S4) | `harness/project/RULES.md`, `harness/extensions/project/process-ownership-guard.ts` |
| R46 | MUST check the port with `lsof` before any start. MUST stop everything you started before yielding, run `lsof` after each stop, report the literal result, and never hand the stop to the human. Tear down the browser and services right after the PR is created, before the Slack and link steps | Orphan browsers and dev servers outlived PRs (S7) | `rules/project/no-orphan-processes-after-use.md`, `rules/project/teardown-verification-tooling-after-pr.md`, `skills/story-workflow/SKILL.md` (Step 7) |
| R47 | NEVER probe a debugpy port with a connect. NEVER add `--reload` under a debugger | The probe burns debugpy's single client slot. `--reload` forks a child the debugger cannot see (S3) | `skills/service-startup-reference/SKILL.md` |

### 4.7 Secrets and security
| # | Rule | Reason | Source |
|---|---|---|---|
| R48 | NEVER read, print, copy, or commit `.env` values, secrets files, private keys, or browser-profile folders. `*****` means set and hidden: never write it into a file, never guess the value behind it, ask the human | Secret values must not enter model context or artifacts | `harness/global/RULES.md`, `harness/extensions/global/guardrails.ts` |
| R49 | MUST type credentials into the browser only as key names. NEVER type a literal. NEVER read or modify the TOTP helper beyond running it | The Playwright MCP substitutes and redacts the value | `agents/flow-runner.md`, `skills/e2e-verification/SKILL.md` |
| R50 | NEVER put a secret value in a plan, draft, comment, or Slack post | Comments and posts have readers | `skills/pr-security-gate/SKILL.md`, `skills/pr-and-team-comms/SKILL.md`, `harness/global/tool-call-auditor.md` |
| R51 | Governed tools (work-item write, work-item comment write, Playwright `run_code_unsafe`) MUST fail closed when the gate config cannot be read | Missing config must not open the gate | `harness/extensions/global/tool-approval-gate.ts` |
| R52 | When a tool is denied, ask or stop. NEVER route around the denial | A denied browser tool led an agent to try a sign-in and a PAT `curl` instead (H5). The "ask or stop" sentence itself is history only (M6); the denials carry reasons | `rules/project/azure-cli-fallback.md`, `harness/extensions/global/guardrails.ts` |

### 4.8 Communication
| # | Rule | Reason | Source |
|---|---|---|---|
| R53 | MUST show every proposal, quote, or draft in a fenced code block, post only after clear approval, show the next iteration only, and write exactly what was dictated. Exceptions: the PR-open Slack line posts with no draft, and any post a loaded skill directs needs none. A skill step that says "show the draft" keeps its gate | Drafts in blocks cannot be mistaken for actions. Always-yes prompts became fact checks (C3, C5) | `harness/project/RULES.md`, `harness/global/RULES.md` |
| R54 | MUST post Slack links as rich-text `link` elements through `blocks`. NEVER use `content_type: text/markdown` for a multi-line post. Test a new layout as a DM first. A post cannot be edited | Markdown collapsed lines, and links did not render (C4) | `skills/pr-and-team-comms/SKILL.md`, `skills/my-pr-status/SKILL.md` |
| R55 | MUST put the answer first, use 10 lines or fewer by default, replace tracker codes with words, define coined labels on first use, translate subagent and reviewer output, and use no emoji | Confusion came from identifiers and undefined labels, not length (C1, C2) | `harness/global/APPEND_SYSTEM.md`, `harness/project/AGENTS.md` (Vocabulary) |
| R56 | MUST say "I do not know" when you do not. Check with a tool before stating a fact. Mark unverified claims inline as `[INFERENCE]`. Ask one batched question with options and a recommendation only when no tool can answer | A wrong answer costs more than a missing one (A1, A4) | `harness/global/APPEND_SYSTEM.md` |
| R57 | NEVER mention advisor notes the human did not see. NEVER open a reply with a correction to them | Relay of unseen sidecar output confused the human (A5) | `harness/global/APPEND_SYSTEM.md` |
| R58 | MUST write all prose to ASD-STE100. NEVER use an em dash | One word per meaning. Text that machines and non-native readers parse | `harness/global/APPEND_SYSTEM.md`, `harness/global/WATCHDOG.md` |

### 4.9 Vault
| # | Rule | Reason | Source |
|---|---|---|---|
| R59 | `raw/` is immutable. `log.md` is append-only: read the tail, append after the final entry, never reuse a line number from an old read, copy the exact `[path#TAG]` header from the last read | A stale line number deleted a neighbouring log header (V4) | `vault/schema.md`, `harness/global/RULES.md` |
| R60 | The vault is the task source of truth. Tracker state never silently overwrites it. Flag drift under `## Drift` | Prevents silent loss of local intent | `vault/schema.md`, `skills/wiki-sync/SKILL.md` |
| R61 | MUST write vault pages through `vault://` URIs, read `vault://wiki/schema.md` before any write, and write only when the human names a wiki skill, asks for a write, or names a page. The scribe advisor and the two crons write inside fixed allowlists | A statement of fact is not a write request | `rules/global/vault-writes-via-vault-uri.md`, `harness/global/APPEND_SYSTEM.md` |

### 4.10 Unattended runs and delegation
| # | Rule | Reason | Source |
|---|---|---|---|
| R62 | Unattended jobs MUST have two barriers (a config overlay that denies tracker and chat write tools, and a prompt allowlist), a guard line in the vault log for idempotency, and stop rules ("a partial run is safer than a wrong write") | The unattended path cannot write even when the prompt is wrong | `automation/board-ingest/overlay.yml`, `automation/board-ingest/prompt.md`, `automation/slack-ingest/prompt.md` |
| R63 | Subagents MUST get absolute task-folder paths and cannot call `move_session`. Reviewers are read-only. The main agent checks each lane claim against the diff before repeating it | Lanes over-claim (P5). Workers share no context | `skills/pr-review/SKILL.md`, `harness/project/RULES.md` |

## 5. Lifecycle protocol

### 5.1 Stage table
Entry points are slash commands that load one skill each, or the router skill `skills/workflow-router/SKILL.md`. A command body is a prompt template: it names the skill, passes `$1`, and never changes a gate. `/story` routes by state: `Backlog` or `In Refinement` loads `story-refinement` (Session A); `Ready for Development` loads `story-workflow` (Session B); later states need a decision (X1).

| # | Stage | Trigger and entry | Inputs | Outputs | Human gate | Tracker state change |
|---|---|---|---|---|---|---|
| 1 | Morning brief | Start of day. `/morning` -> `morning-brief` | Vault note `notes/morning-brief.md` written by `automation/board-ingest/` | Approved state moves, closed vault tasks, log entry | One approval for the list. Any move the brief did not propose asks again | Agent writes `Resolved` or `Ready for Test` for merged items after that approval. Never `Closed` or `Accepted` |
| 2 | PR status | "Status of my PRs". `/pr-status` -> `my-pr-status` | Live tracker reads: PRs, votes, threads, builds | One fixed card in one fenced block | None. A Slack post only on request, with a draft | None |
| 3 | Daily poll | "What did I do on <day>?" -> `daily-work-poll` | Tracker WIQL (UTC range), local `PR-*` and `PR-REVIEW-*` folders, git history | Per-item report | None | None |
| 4 | Triage | `/triage <id>` -> `ticket-triage` + `ticket-triage-profile` (Big-tier model) | Ticket, code at `origin/main`, vault | Spec comment (`## Triage Specification`), or contract comment (`## Agent Contract (Ready for Development)`), or `## Triage Notes` | Approve the drafted text. Approve the Bug state offer. Approve split-off tickets | Story `Backlog` -> `In Refinement` -> `Ready for Development` (after approval). Bug `New` -> `Ready for Triage` offered |
| 5 | Story refinement (Session A) | `/story <id>` in `Backlog` or `In Refinement` -> `story-refinement` | Ticket, code through existing `main` worktrees | Agent Contract in the description, one short comment, vault log line | The final move asks first | `Backlog` -> `In Refinement`; `In Refinement` -> `Ready for Development` |
| 6 | Bootstrap | Ticket number plus "start work" -> `ticket-bootstrap` | Ticket, state history (Bugs), PR and branch lists | Task folder, worktrees, LSP and DAP config, session moved into the folder | None for wiring. Stop and ask on mixed PR mode or local commits on a colleague's branch | Bug `New` -> `Ready for Triage`, only when the state is `New` |
| 7 | Bug path | `/bug <id>` -> `bug-workflow` | Bootstrapped folder | `plan/` docs, repro, tests, one commit per repo, PRs, `review/SECURITY-GATE.md`, vault lines | PR opens with no prompt once the checklist passes. Repro comment after approval. A returned bug asks before `Ready for Fix` | `Ready for Triage` -> `Ready for Fix` after reproduction. Hold. `Resolved` on merge |
| 8 | Story path (Session B) | `/story <id>` in `Ready for Development` -> `story-workflow` | The ticket only | Plans, `plan/VERIFICATION.md`, PRs, decision pages | None. Escalation is by comment | `Ready for Development` -> `In Development`. `Ready for Test` on merge. `In Test` after QA proof. `Blocked` on escalation. Back to `In Refinement` on a failed gate |
| 9 | Local services | Any run, debug, or live check -> `service-startup-reference` and the `services` tool | Task folder | Healthy stack, logs, stop proof | A direct `hub` start needs approval. Never touch a foreign process | None |
| 10 | Verification | UI bug or live proof -> `e2e-verification`, `flow-schema`, agent `flow-runner`, agent `error-detective` | `docs/flow.yaml`, running stack | `result.yaml`, screenshots, vault line | Local login is automatic. QA login is manual | None |
| 11 | Regression test | A fix or AC needs a test -> `regression-test-placement` | The change | Failing-then-passing test, mutation record, catalogue case | None | None |
| 12 | Security gate | Before a PR or a push of own code -> `pr-security-gate` | Branch diff | `review/SECURITY-GATE.md`, allowlist entries, Bug drafts | Filing deferred Bugs asks. The PR does not wait | None |
| 13 | PR creation | Gate passed -> `pr-creation` | Commit, evidence images | PR, linked work item, reviewers | Arm auto-complete only after a required reviewer is confirmed | None (hold the state) |
| 14 | Team notification | PR just opened -> `pr-and-team-comms` | PR URL | One Slack line, verified in history | None for the fixed line. Drafts for anything else | None |
| 15 | Review comments | `/comments <pr>` -> `pr-comments` | PR threads | Fix commit, replies, `comments/THREADS.md` or `review/VERIFY-HANDOFF.md` | Ask before the push and before the replies. Reviewer mode posts nothing | None |
| 16 | Merge conflict | `/conflict <pr>` -> `merge-conflict` | PR | Merge commit, `conflict/CONFLICT-NOTES.md` | Ask before the push | None |
| 17 | Merge | `/pr-merge [pr]` -> `pr-merge` | Own PR, or a scan of own PRs | Squash merge through auto-complete, closed vault task, log entry | One combined ask | `Resolved` or `Ready for Test`, folded into the ask |
| 18 | Post-merge | After an own PR merges -> `post-merge` | Merged PR | `docs/HANDOFF.md`, comment draft, vault line | The comment posts after approval | None |
| 19 | Deployed-to-QA check | "Is it on QA?" `/qa-deployed` -> `tasks-deployed-to-qa`, `deployed-version-check` | Items, fix commits, deploy pipelines | CONFIRMED or NOT CONFIRMED report | None. The moves are skill-directed | `Resolved` -> `Ready for Retest`. `Ready for Test` -> `In Test` |
| 20 | Cleanup | `/cleanup` -> `task-cleanup` | Task folders | Archive, freed disk | Approval before any delete | None |
| 21 | Review another's PR | `/ado-review <pr>` -> `pr-review` | PR number | `review/REVIEW.md` and lane reports | Approval before any post or vote | None |
| 22 | Side processes | Scan report, missing bare clone, script bug -> `checkmarx-handling`, `repo-onboarding`, `task-branch-script-internals` | Report, repo name, script | Bugs and a vault note, a bare clone, a script fix | Approval before creating work items | None |
| 23 | Vault workflows | A named wiki skill -> `wiki-*` | Sources, transcripts, tasks | Pages and log lines | Gates per skill (see 5.4.23) | `wiki-sync` and `wiki-task-loop` write tracker moves under approval |
| 24 | Unattended ingest | Cron -> `automation/board-ingest/`, `automation/slack-ingest/` | Board, Slack | Vault notes, inbox tasks | None: read-only on tracker and chat | None |

### 5.2 State ladders
The agent writes only the rungs marked "agent". The tracker's own state list is authoritative: fetch it with `wit_work_item` `get_type` when unsure. Spellings such as `Deffered` are the tracker's.

| Bug rung | Who writes | Trigger |
|---|---|---|
| `New` -> `Ready for Triage` | agent, no prompt | Bootstrap Step 5, only when the state is `New` |
| `Ready for Triage` -> `Ready for Fix` | agent, no prompt (a returned bug asks first) | `bug-workflow` Step 2, after the bug reproduces |
| hold at `Ready for Fix` | none | The whole time a PR is open, in review, or revised |
| `Ready for Fix` -> `Resolved` | agent: no prompt in the workflow skills, folded into the `pr-merge` ask, one approval in `morning-brief` | Every linked PR Completed. Abandoned PRs do not count |
| `Resolved` -> `Ready for Retest` | agent, no prompt | `tasks-deployed-to-qa` proves the fix is in the QA deploy by ancestry |
| `Ready for Retest` -> `Closed` | tester only | Fix verified by a human |
| side: `Bug Test Failed`, `Blocked`, `Reopen`. Terminal: `Cancelled`, `Duplicate`, `Deffered` | human or tester | n/a |

| Story rung | Who writes | Trigger |
|---|---|---|
| `Backlog` -> `In Refinement` | agent, no prompt | Start of refinement or triage |
| `In Refinement` -> `Ready for Development` | agent after the human approves | Refinement Step 6. Triage after the contract is approved and the comment re-fetched |
| `Ready for Development` -> `In Development` | agent | `story-workflow` Step 2 |
| any -> `Blocked` | agent | An escalation stop condition |
| gate failure -> `In Refinement` | agent | Thin or missing contract at Step 0 |
| `In Development` -> `Ready for Test` | agent (same folding as the bug) | Every linked PR Completed |
| `Ready for Test` -> `In Test` | agent, no prompt | `tasks-deployed-to-qa` proof of the QA deploy |
| `In Test` -> `Pending PO Review` -> `Accepted` | tester, then product owner | Never the agent |

### 5.3 Ladder rules
- One neighbouring state per write, then re-fetch and check. A story jump of more than one returns HTTP 400 although the matrix shows all-to-all.
- A PR merge never moves the item, even with `transitionWorkItems: true`. The agent writes `Resolved` or `Ready for Test` itself.
- A bug the tester moved back out of `Resolved`, `Ready for Retest`, or `Closed` is a returned bug. Never overwrite its state. The tester's reason is in the comments.
- A new story may land on `Backlog` rather than `New`. Re-fetch after any type change.
- Use a `/rev` test operation (optimistic concurrency) on every state write.
- A Bug has no `Ready for Test`. A Story has no `Ready for Retest`.

### 5.4 Per-stage details and decision points
Each entry lists only what the skill text does not make obvious: decisions, stops, and evidence. Read the skill for the full step list.

**5.4.1 Morning brief** (`skills/morning-brief/SKILL.md`)
- Precondition: the board job ran. Read `notes/morning-brief.md`. If its `date` is not today, say so and re-derive "Ready to close" live with the Step 7 table of `automation/board-ingest/prompt.md`. Never act on a stale list silently.
- Show each row as `<id> <title>: <state> -> <proposed>, PR <repo> #<id> merged`. Ask once for the whole list. Accept a subset. Ask again for any move not proposed.
- Apply: one update per row with a `/rev` test and a `replace` on the state. Re-fetch each item and report any that did not move. Then set the vault task page `status: review` to `done` with `completed`, and append a log entry.
- Optional: for a "Needs QA deploy check" row run `tasks-deployed-to-qa`, then write `Ready for Retest` or `In Test` with no prompt after the ancestry check passes. Offer `post-merge` for merged PRs with no `## Post-merge` line.

**5.4.2 PR status** (`skills/my-pr-status/SKILL.md`)
- Always live. One list call per repo in parallel (no project-wide list exists). Never from memory or the vault.
- Build class per PR: `no run`, `running`, `failed`, `stale` (green but `main` moved, or a newer push has no run), `passed`. "Stale" is an inference, not a proven policy rule.
- Drop "safe auto-complete" PRs (auto-complete armed, enough non-self approvals, no open threads, no conflict, pipeline passed) from outreach lists.
- Output: the exact card, one fenced block, nothing else. State priority: merge conflict, pipeline failed, rejected, waiting for author, open comments, pipeline needs re-run, needs an approval, ready to merge.
- Slack variant only on request: draft, wait for "send it", send with `blocks`.

**5.4.3 Daily poll** (`skills/daily-work-poll/SKILL.md`)
- Pin the date range twice: UTC for the tracker, local for file times. Three independent sources. Say plainly when a source returned nothing. Known defect: Step 4 reads bare repos (X3). Give a recap only when asked.

**5.4.4 Triage** (`skills/ticket-triage/SKILL.md`, `skills/ticket-triage-profile/SKILL.md`)
- The command states a Big-tier precondition and does not check it. The profile must carry eight sections: Pre-flight, Fetch, Code locations, Knowledge sources, Spec targets, Write rules, State moves, Next step. A profile rule beats a generic rule. With no profile the skill asks three questions (which tool reads and writes tickets, where the spec goes, where the code lives) and offers no state move.
- Writes only to the ticket. Never creates a branch, worktree, or folder. If a task folder exists, `move_session` into it.
- Resume rule: read an earlier spec or `## Triage Notes` first and never re-ask a resolved question.
- Ground in code with one `scout` per candidate repo, reading `origin/main`, not a possibly stale worktree. Give one verdict on the ticket's main claim: `confirmed`, `contradicted`, `insufficient detail`. Run no services or tests.
- Brief (8 bullets or fewer) -> walkthrough (one topic per turn, plain chat turns not the `ask` tool) -> teach-back gate (pass only when every key point is covered; say "Understanding confirmed") -> grill (one question per turn with a recommended answer, grounded in code; also grill the task breakdown) -> draft.
- If a named outsider's answer blocks a testable spec, draft `## Triage Notes` instead. Otherwise draft the spec in a fenced block, one version per turn, and write only after "approved" or "write it". Never remove or reword original ticket text. If the tracker rejects the size, split at `### Tasks` into `(1/2)` and `(2/2)`.
- Task rules: tier names only (never model names). A Big task is always Main. A Mid or Small task is Delegated only when self-contained with inputs, outputs, and a "Done when" check. Wave = 1 for no dependencies, else 1 plus the highest dependency wave. Same-wave tasks run in parallel only on different files.

**5.4.5 Refinement, Session A** (`skills/story-refinement/SKILL.md`)
- Do not run the branch script: grilling may split, shrink, or reject the story. Ground in code through the existing `main` worktrees (the skill cites the bare-clone path; X3).
- Write the six-section contract into the description by read-modify-write, in the field's format. Plain `update` takes no `format`: use `update_batch` for Markdown. Re-fetch and check that the contract renders and the human text is intact.
- One short comment: refinement done, tag the product owner. Never put the contract or a plan dump in a comment.
- Ask before `In Refinement` -> `Ready for Development`. Add a vault log line. End the session.

**5.4.6 Bootstrap** (`skills/ticket-bootstrap/SKILL.md`)
- If a `*-<NUM>-*` folder exists, `move_session` first. Fetch through the tracker MCP; on failure log in with the CLI and retry the MCP call, never replace it with a CLI read.
- Returned-bug detection (Step 1b, Bugs only): read the full state history. POST set = `Resolved`, `Ready for Retest`, `Closed`. RETURN set = `New`, `Ready for Triage`, `Ready for Fix`, `Bug Test Failed`, `Reopen`, `Blocked`. STOP set = `Cancelled`, `Duplicate`, `Deffered`. Returned = history reached POST and the state is now in RETURN. Compute the move-back revision, window start, round `n`, slug, and PR mode: only active PRs = open-PR mode; only completed PRs or none = merged mode; both = mixed, stop and ask. Return branch `fix/<slug>-<N>-r<n>`.
- Type branch: Bug -> `bug-workflow`. Story -> only if the state is `Ready for Development` and a contract exists, else route to refinement.
- Wire with `./setup-task-branch.sh <branch> <target_dir>` from the tasks root. Branch `fix/<slug>` for a Bug, `feat/<slug>` for a Story. Read the folder listing yourself to verify. Step 3a (colleague's pushed branch): check ticket links, PR list with all statuses, branch list filtered by ticket number; if found, rerun with their exact branch name, prove nothing of yours is on the local branch, fetch with an explicit refspec, `reset --hard` to theirs, work on top and never over (no rebase, amend, or force-push of their commits).
- Step 4: never remove symlinks, branches, or worktrees after the script. Step 4b: `./setup-task-lsp.sh <target_dir>`, then `move_session` into the folder.
- Step 5: Bug -> write `Ready for Triage` only if the state is `New`. Story -> do not set; verify `Ready for Development`. Re-fetch.
- Ticketless variant: `RESEARCH-00000-<slug>`, branch `research/<slug>`, skip Steps 1 and 5. Never rename later; bootstrap fresh if a real ticket appears.

**5.4.7 Bug path** (`skills/bug-workflow/SKILL.md`)
- Consent: a session whose task is "Fix bug N" has implementation consent from the first message. No pause between design doc and code.
- Step 0 (returned bug only; all results in `plan/return-r<n>.md`): collect evidence inside the window (comments, repro-step edits, attachments, linked PR threads with the full response). Pick repro steps (evidence wins; else the original field, recorded as such). Merged mode: check the merge commit is on `main`, find the QA deployed ref with `deployed-version-check`, and test `merge-base --is-ancestor <merge-sha> <deployed-ref>`. If QA lacks the fix: stop, show a draft comment, write no state. Reproduce on QA first (a flow with `env: qa`, `expect: broken`, human logs in; or ask once; else record "QA: not run" with the reason), then locally. Decide with the returned-bug table below. Write a line under `## Returns` on the vault task page in every outcome, including a stop.

- Step 1: for a UI bug, write `docs/flow.yaml` and run `flow-runner` with `expect: broken` on the pre-fix commit before any manual repro. Per repo: read the README for the documented start command (never guess), start through `services`, prove health. If the ticket names an endpoint mismatch, `curl` both paths and report both status codes. Health alone is not enough when several stacks may run (5.4.9). If the bug does not reproduce, stop and report the exact evidence. Once it reproduces, write `plan/repro.md` and show the steps as a comment draft; never write the repro-steps field.
- Step 2: `Ready for Triage` -> `Ready for Fix`, re-fetch. A returned bug asks in chat first and writes nothing if already `Ready for Fix`.
- Step 2b: diagnose with the debugger, not print statements. Restart only the suspect service in debug mode. Record observed values in the fix plan. Check recent history with `git log` and `git blame`: a bug that arrived with a recent change is fixed in light of that change. Detach and restart in normal mode before live verification. Skip only when request and response evidence alone proves the root cause, and say so. Attach route: `debug launch` with a named adapter first; a raw DAP client for a service the `services` tool started in debug mode; `debug attach` only for a service started another way.
- Step 3: `plan/fix-plan-<repo>.md` per repo with real `file:line`; two or more repos also `plan/FIX-PLAN.md` with the cross-check and every deploy order. Spot-check citations. List every file; a file outside the list needs a one-line reason. Failing test first, output recorded under `## Failing test`. A returned bug writes `-r<n>` docs and a required `## Why the previous fix failed`.
- Step 4: live-verify. Test the backend port directly when a proxy may hide the event. Local UI checks log in by themselves. Run the PR-build checks. Mutation check (the form follows `git diff --quiet HEAD`: stash for an uncommitted fix, checkout from `origin/main` for a committed one; see `skills/regression-test-placement/SKILL.md`). Regression placement. UI bug: run `flow-runner` with `expect: fixed`, read `result.yaml` yourself, check one screenshot against its citation. Tear down.
- Step 5: one commit per repo; `./secret-scan.sh` before any force-push; `./self-review.sh` until `RESULT: clean`; security gate; then open the PR (R22). A returned bug in merged mode opens a new PR from `fix/<slug>-<N>-r<n>`; in open-PR mode it pushes to the existing PR (own commit: amend and force-push; a colleague's branch: a new commit on top).
- Steps 6 to 8: link and verify; hold `Ready for Fix` while the PR is open; write `Resolved` when every linked PR completes; `post-merge` after the merge; one decision page per repo with a real code change.


Returned-bug decision table (Step 0):

| QA | Local | Action |
|---|---|---|
| reproduces | reproduces | Confirmed. Go to Step 2 |
| reproduces | clean | Match QA locally, up to 3 attempts, each changing one variable that differs from QA (env flag, test data, user role, viewport). After 3 clean attempts stop and report both results. No state |
| clean or not run | reproduces | Confirmed. Record the QA result. Go to Step 2 |
| clean, or not run and clean | clean | Stop. Draft a comment asking the tester for environment, build, account, exact steps. No state. Post only after approval |

**5.4.8 Story path, Session B** (`skills/story-workflow/SKILL.md`)
- Step 0 gate: state is `Ready for Development` and the contract (description, or the newest comment headed `## Agent Contract (Ready for Development)`, `(1/2)` and `(2/2)` read as one) has six non-empty subsections and no `TBD`. Failure: comment naming each gap, tag the refiner or product owner, move to `In Refinement`, re-fetch, stop; create nothing.
- Step 1: run `ticket-bootstrap`. A `STORY-<NUM>-*` folder means resume: `move_session` first and skip steps already done (X1).
- Step 2: `Ready for Development` -> `In Development`; `plan/story-plan-<repo>.md` per repo; two or more repos add `plan/STORY-PLAN.md`; map every AC to the plan and its verification. An unmapped AC is a gap and goes to the escalation rule. No human ack and no plan posted.
- Escalation (to the end): the contract's stop conditions, plus code contradicts a contract item, an unnamed repo or non-goal is needed, an AC maps to nothing or its verification cannot run. Then: comment with `file:line` evidence, tag the relevant person, `Blocked`, stop.
- Steps 3 and 4: one worker per repo in parallel with exact file lists and test names; re-check plan citations against live source; read the real diff. Test first for every behavior AC; place tests per 5.4.11; run integration-marked tests once against real dependencies; run each AC's live check for real.
- Step 5: verification gate before any PR: (1) build, (2) tests and lint, (3) each changed service starts through `services` and answers a real request, (4) every AC's verification run with observed results, (5) conforms to the plan (diff `main...HEAD`), (6) mutation check, (7) self-review clean, (8) security gate. Write an AC-to-evidence table in `plan/VERIFICATION.md`. A failed item that cannot be fixed inside the contract escalates. Pushing before the gate is allowed after `secret-scan.sh` prints `RESULT: clean`.
- Step 6: open one PR per repo with no prompt; `## Evidence` holds before and after images; never arm auto-complete; paste each PR URL. Draft path: `isDraft: true`, no Slack line. Leave the state at `In Development`.
- Step 7: release every resource (browser, services with `port_free` and `debug_port_free`, `docker compose down` without `-v`); confirm with `lsof` and `docker ps`. Step 8: states on merge and QA proof. Step 9: PR-open line, decision pages.

**5.4.9 Local services** (`skills/service-startup-reference/SKILL.md`)
- Absolute rule: a process on a port belongs to another session until proven otherwise. Never stop, kill, or restart it, even when the human authorizes it. Pick another port and rewire callers, or ask the human to coordinate.
- The `services` tool owns port checks, dependency setup, start, sibling wiring, health, stop. Start order: `file-gateway`, `media-mcp`, `data-mcp` in parallel, then `orchestrator`, then `web-app`. An explicit port is strict. `web-app` is always strict on 5173 because local auto-login works only there. Env precedence: inherited, then tool wiring, then your `env`.
- Cross-wiring check before trusting a stack: derive expected sibling URLs from proxy source or a startup log line (not `.env`); `lsof` the listener, then its cwd, then `ps` for elapsed time; fix from your side only; delegate chain proof to `error-detective` when more than two repos are involved.
- Debug mode: `debugpy --wait-for-client`; never probe the debug port with a connect (check passively with `lsof`); never `--reload`; after a debug stop check `debug_port_free`.
- Teardown: stop every service through the same tool in the same turn, run `lsof` for each port, report the literal result, check child, reloader, and helper PIDs. If the ownership guard blocks a stop of something you started, report it and ask; never route around it.

**5.4.10 Verification** (`skills/e2e-verification/SKILL.md`, `skills/flow-schema/SKILL.md`, `agents/flow-runner.md`)
- Auth by service: the orchestrator has a local-dev bypass (needs `ENV=local`; read the token through the app's own config loader, never `cat .env`). The file gateway and the web app have no bypass. A local web-app run logs in as a test user on a tenant the consultancy owns; QA needs the human.
- Local login (Playwright MCP, `--isolated`, so every session starts logged out): navigate and snapshot; confirm the right user; type key names only; TOTP digits come from `node .omp/playwright/totp.mjs`. Failure rule: report `auto-login failed: <AADSTS code or step name>` when the page shows an `AADSTS` code, the code is wrong twice, or no step matches after one 3-second wait. Never ask the human to log in for a local run.
- One flow, three runs: run 1 local on `main` before the fix with `expect: broken` (mandatory; validates the flow); run 2 local on the fix branch with `expect: fixed`; run 3 on QA with `expect: fixed` after confirming the fix is deployed (human login handoff). Prove the served build before dispatch (`lsof` PID, process cwd, `curl` one changed module) and pass `served_sha_verified: true`.
- `flow-runner` refusals: `expect: fixed` on a flow with no `validated` block; a QA base URL that differs from `<QA_URL>`; a host inside a step; an unverified `base_url`. After each run the session (not the runner) writes a `## Flow runs` line on the vault task page.

**5.4.11 Regression tests** (`skills/regression-test-placement/SKILL.md`)
- The kind of thing that broke decides where the test goes (table in the skill). Test first. Mutation check form: `git diff --quiet HEAD -- <files>` exits 1 for an uncommitted fix (stash form) and 0 for a committed fix (checkout from `origin/main`, then restore from `HEAD`, then `git status --short` must be clean).
- Prove a catalogue case against the local orchestrator before the PR, not against dev (dev runs `main`, so the new case fails there until the fix deploys). `post-merge` runs it after the dev deploy. Never edit a catalogue case to make a regression pass, never lower a count, never delete a case without a ticket.

**5.4.12 Security gate** (`skills/pr-security-gate/SKILL.md`, `agents/pr-security.md`)
- Triggers: before every new PR and before every push of your own code to an open PR. `merge-conflict` is exempt. Light check before any other push: `./secret-scan.sh <task>/<repo> <base>`, push only on `RESULT: clean`; exit code 2 means `gitleaks` is missing or the base is wrong: fix that, do not push.
- Base: `origin/main` for a new PR, `origin/<src>` for a push to an open PR. Run `./self-review.sh`, then spawn one `pr-security` per repo in one batch, then read each verdict yourself (line 1 is `VERDICT: clean` or `VERDICT: findings`).
- Dispositions: `introduced` (on a `+` line) -> `fix-now`; a gitleaks row that is not a real secret -> `false-positive` (add a rule-scoped allowlist entry in `gitleaks.toml`, not a fix round); `pre-existing` -> `defer-bug`. At most 2 fix rounds; a third verdict with an unresolved introduced finding takes the draft-PR path. `fix-size: too-big` also takes the draft path. Challenge a wrong origin tag once with `file:line` evidence; the second ruling is final.
- Draft-PR path: `isDraft: true`, link and add reviewers as normal, no auto-complete, no Slack line, no work-item move. Publish with `isDraft: false` after the gate passes.
- Secret on the remote: an amend changes the SHA, so `git branch -r --contains` does not show exposure; fetch the branch and check the ref. A failed fetch on a branch that may exist means treat the secret as exposed. Remove it in the PR, draft a rotation Bug, and put "rotate credential" first in the final report. Never put a secret value in a draft.
- Record: `review/SECURITY-GATE.md`. The PR does not wait for the approval to file deferred Bugs.

**5.4.13 PR creation** (`skills/pr-creation/SKILL.md`)
- Checklist: gate passed; branch `<type>/<short-dash-summary>` off `main`; Conventional Commit title with ticket suffix; template A (bug) or B (feature or chore); create with the repo GUID; link and re-fetch; add standing optional reviewers (read the branch policy first and add only people it has not attached); paste the PR URL; arm auto-complete only after a required reviewer is confirmed (story Session B never arms it).
- Template A headings: `## Bug`, `## Root cause`, `## Fix`, `## Tests`, `## Evidence`. Template B: `## What changed`, `## Why`, `## Tests`, `## Evidence`. 200 words or fewer, 4 bullets per section or fewer, images do not count toward the cap.

**5.4.14 Notification** (`skills/pr-and-team-comms/SKILL.md`)
- After a PR opens in the bug or story workflow, post one line to `#<team-channel>` with no draft: `PR <PRID> for review (<repo>): <summary> (<Bug|Story> <N>)`. `<summary>` is the PR title minus its Conventional Commit prefix. A returned bug's new PR appends ` (re-fix)`. One message per PR. No @mentions. Draft PRs and pushes to open PRs get no post. Send through `blocks`, then read channel history to confirm.
- Any other post: fenced draft, then "send it".

**5.4.15 Review comments** (`skills/pr-comments/SKILL.md`)
- Discover the PR as in `merge-conflict` Step 1. Stop when the PR is not Active. The PR author picks the mode: created by `<YOUR_EMAIL>` -> author mode; anyone else's -> reviewer mode.
- Author mode: read every thread verbatim; re-read the code at each cited `file:line`; classify each in-scope thread as `fix` (real and in this PR: reproduce, fix, verify, reply, leave Active), `answer` (reply with `file:line`), `disagree` (reply with reasoning), or `defer` (file a Bug, reply with its number). Show the table and ask once. Each `fix` is a bug: reproduce first, fix the source (never special-case the reviewer's example), keep the reproduction as a regression test when it guards a contract. Run PR-build checks. One commit for all threads: amend when the PR has exactly one commit of its own (push needs `--force-with-lease`), otherwise add one commit; never amend a merge commit. Run the security gate with base `origin/<src>`. Ask before the push, then ask once for the set of replies; replies cite `file:line` and the commit, name the Bug for a deferral, and never say "addressed" without an evidence line. All four classes stay Active after the reply.
- Reviewer mode (your comments on someone else's PR): never edit, commit, or push on that branch. Mark each thread `replied`, `status-only`, or `silent`. Wire a read-only worktree with `setup-task-branch.sh --pr`. Write `review/VERIFY-HANDOFF.md`. Report counts and state that nothing was posted.

**5.4.16 Merge conflict** (`skills/merge-conflict/SKILL.md`)
- Gates before any git command: PR Active; creator is `<YOUR_EMAIL>`; merge status is "conflicts" (the integer is in the skill; do not show it). Status "queued" means re-read after 15 seconds, up to 3 times.
- Find the task folder by symlink target (strip the branch suffix and require the remaining basename to equal `<repo>-bare`). More than one hit: stop and let the human pick. None: create a `BUG-`, `STORY-`, or `PR-<number>-<summary>` folder with `setup-task-branch.sh --pr`.
- Capture `pre-merge.patch` (three dots) with an absolute path. `git merge --no-ff origin/<target>`; in this merge `--ours` is the PR branch. Keep both intents; take one whole side only when the other deleted the file or both are byte-identical. Regenerate lockfiles. Capture `post-merge.patch` (two dots), diff the two, and explain every difference. Run PR-build checks. Ask, then plain push. Re-read merge status every 15 seconds up to 4 times.

**5.4.17 Merge** (`skills/pr-merge/SKILL.md`)
- Own PRs only. No number: list and let the human pick; never merge an unpicked PR. Route by status: Abandoned -> stop; Completed -> go to the work-item step; Active -> continue.
- Gate table from five parallel reads (votes, threads, pipeline against `main`'s tip, work items, policies through `az repos pr policy list` when the CLI is logged in). Rows: Approvals, Comments, Conflicts, Pipeline, Paired order (`(k/n)` title suffix: every partner with a smaller index must be Completed), Policies. Classify open threads: `superseded` (every other commenter approved after their own last comment: this run closes it), `chit-chat` (ask in the combined ask), `feedback` (blocks).
- Clear failing gates in order (a push resets votes): conflict, comments, approvals, pipeline (re-queue a stale build through the policy action, not a new run), paired order, policies. Re-read everything after the last action; a table from before a push is stale.
- One combined ask (summary, one question per chit-chat thread, then Go or Stop), then close threads, re-verify, arm squash auto-complete with `transitionWorkItems: false`, `bypassPolicy: false`, never set a merge commit message; poll until Completed; confirm the source branch is gone. Then move the work item one rung (5.2), close the vault task page, append a log entry, report.

**5.4.18 Post-merge** (`skills/post-merge/SKILL.md`)
- Per merged repo: find the deploy pipeline, confirm the newest `main` build is at or after the squash commit and succeeded (still running: poll every 60 s up to 20 times; failed: stop, report the build id and failing log, write no handoff).
- Dev evidence by change kind: a web-app change on a private dev endpoint records "dev: not reachable from this host" and uses the local `expect: fixed` flow run as evidence; an API or answer change runs the API e2e regression pipeline (`<E2E_PIPELINE_ID>`) and confirms the new catalogue case passed. A failed new case stops the stage.
- Write `docs/HANDOFF.md` (what changed, where to test, steps with expected results, evidence, a three-item tick list). Draft a comment `@<tester> <what now happens>. On <env>: <click path>. Steps and evidence: ...`; post only after approval. Name the tester for the mention only; do not reassign. Add a `## Post-merge` line on the vault task page.

**5.4.19 Deployed-to-QA check** (`skills/tasks-deployed-to-qa/SKILL.md`, `skills/deployed-version-check/SKILL.md`)
- Never prove deployment with dates. For each item read the `Pull Request` and `Fixed in Commit` links (an item can carry commits in several repos), fetch each clone with explicit refspecs (heads and tags, prune), find the QA-deployed commit per repo from the deploy build's `sourceVersion`, and run `git merge-base --is-ancestor <fix-sha> <deployed-sha>`. Exit 0 = CONFIRMED; anything else = NOT CONFIRMED (do not round up).
- Two pipeline definitions can share a base name: one builds on every `main` push but is gated to skip the push and restart step (it never deploys; skip it); the other fires on a git tag and really deploys. Verify trigger patterns against the YAML. For repos with a static image tag, only the triggering git tag identifies the commit. A web app that deploys a separate `qa` branch makes a date check wrong for exactly that repo.
- Cross-check the live App Service config with `az rest` on the plain site resource (`properties.siteConfig.linuxFxVersion`). On `AuthorizationFailed`, report the gap and fall back to pipeline evidence with lower confidence. Report one YAML block per repo with `confidence` high, medium, or low; never present stale or unverified data as high.
- Environment input exists but only QA is implemented; any other environment stops with a message. The check gates `Resolved` and `Ready for Test`: when every repo row is CONFIRMED it writes `Ready for Retest` (Bug) or `In Test` (Story) with no prompt, then re-fetches. A story that is production provisioning deploys nothing to QA: flag it not applicable.

**5.4.20 Cleanup** (`skills/task-cleanup/SKILL.md`, `scripts/cleanup-task-folders.sh`)
- Run from the tasks root only. `report` is read-only (TSV: `FOLDER`, `REPO`, `STRAY`, `ORPHAN`, `SUMMARY`). Resolve PR state for every repo with unique commits (precedence: Active beats Completed beats Abandoned beats none) and ticket state.
- CLEAN: every repo with unique commits has a Completed or Abandoned PR, no repo is dirty, ahead, or diverged, age at least 7 days, ticket state `Resolved`, `Ready for Retest`, `Closed`, `Cancelled`, `Duplicate`, or `Deffered` (or no ticket). CLEAN (unused): no repo has unique commits. KEEP: anything else, with the strongest single reason.
- One table, ask once, let the human drop rows. Apply in order: `clean --apply`, `clean-worktree --apply`, `strays --apply`, `prune --apply`. Large removals can hit the 300 s shell cap: pass `timeout` and apply in batches (the author's log used 3 to 4 folders; the skill states no batch size, M6). Never `--force` without an instruction naming the folder.

**5.4.21 Review another person's PR** (`skills/pr-review/SKILL.md`)
- Locate (`status: All`), fetch with changed files, fetch linked items with `expand: "All"`. Wire a read-only worktree with `./setup-task-branch.sh --pr <repo> --target-branch <target> <src> PR-REVIEW-{NUM}-{summary}`; verify the worktree head equals the PR head. Stage `review/PR-CONTEXT.md` and `review/diff.patch` (absolute path). Read the diff yourself before delegating.
- Fan out three read-only lanes in one batch: `security-reviewer`, `reviewer`, `architect-reviewer`. Shared contract: no formatters or test runs, every finding cites `file:line`, `## Verdict` first. Compile `review/REVIEW.md` and spot-check every lane claim you repeat. The advisor `PRSecurity` wakes when the skill loads.
- Never vote, comment, or complete without explicit approval. Thread anchors must be changed files on lines inside diff hunks; the API needs start and end offsets. Removing a posted comment needs the CLI (the MCP tool has no delete action). Check auto-complete before any `Approved` vote (R27).

**5.4.22 Side processes**
- `skills/checkmarx-handling/SKILL.md`: get a task folder first, never download into the tasks root; read counts from the build log; the MCP artifact download writes a 0-byte file, so retry once through MCP then use the CLI artifact download into `<task>/checkmarx/`; triage every finding as Real, False positive (name the proving line), or Duplicate; draft one Bug per real finding; ask before creating work items; record a vault note.
- `skills/repo-onboarding/SKILL.md`: resolve the exact repo through `repo_repository` `list`, use the `sshUrl` verbatim (including a literal `%20`), `git clone --bare`, give it a `main` worktree. Conflicts with the parent-folder guard (X3).
- `skills/task-branch-script-internals/SKILL.md`: read before editing `scripts/setup-task-branch.sh`; test in a sandbox with synthetic bare repos, never against real ones.

**5.4.23 Vault workflows** (`skills/wiki-*`)
- `wiki-ingest` (clipping or raw file -> `raw/`, `sources/`, links, index, log; no gate). `wiki-meeting` (clean captions, ask for attendees, never guess a project or org link; no gate). `wiki-task-loop` (pick task, branch `task/<slug>`, implement, one gate; for a ticketed task inside the tasks root the project rules win over that gate). `wiki-sync` (push vault state to the tracker, close merged reviewed tasks, pull new items as `inbox`, flag drift; approvals for review or done pushes). `wiki-query` (read, cite with wikilinks, file durable answers as notes). `wiki-lint` (orphans, unresolved links, schema drift, stale `doing` tasks over 5 working days, contradictions, index gaps; writes a lint note). `wiki-comms` (read Slack, resolve people, draft, send only approved text unedited). `wiki-spec` (read before changing workflows, schema, or structure).
- Order of changes: `vault/schema.md`, then templates, then views, then skills.

**5.4.24 Unattended ingest** (`automation/`)
- Both jobs run as one headless call with an overlay that denies write tools. They stop on doubt, write only inside a path allowlist, and use a log header as the idempotency guard (`board scan <date>`, `daily scan <date>`). Board ingest: two scoped WIQL queries plus the author's own items, fixed proposal table, two owned notes, mirrored fields and `## Drift` lines on existing task pages. Slack ingest: one raw file, one source page, link lines, inbox tasks; gap-fill from the oldest missing day with a cap of 21 days; a day with a raw file but no guard line is skipped as "needs manual reconciliation".

## 6. Gate policy

### 6.1 How to read the gates
- "Ask" means: show the proposal in a fenced block in chat, then wait for a clear approval ("send it", "approved", "write it", "go"). If unsure, ask one direct question. Show the next iteration only, then stop. Treat the next human message as an iteration request.
- A skill step that says "draft, then wait" keeps its gate. A skill step that says "open the PR", "post the notification", or "move the state" is itself the authorization: do it without a draft or an ask, then re-fetch or confirm.
- Three enforcement layers apply: prose rules (`harness/project/RULES.md`, `harness/global/RULES.md`), skill steps (the gate sits at the exact moment it applies), and the harness (`tools.approval`, the approval gate, guard extensions). Prose alone failed more than once (S4, H7), so every hard guarantee has a layer 3 artifact.
- A value shown as `*****` is set but hidden. Never write the asterisks into a file. Never guess the value. Ask the human.

### 6.2 Always the human's
`Closed` (tester). `Pending PO Review` (tester). `Accepted` (product owner). Votes. Merges (the agent arms auto-complete only inside the combined ask of `pr-merge`). QA login. The decision whether any Slack message other than the PR-open line goes out.

### 6.3 Ask-before actions
| Area | Action | Gate |
|---|---|---|
| Tracker | Move a work item to a review or done state that is not on the autonomous list (6.4) | Ask. Never write `Closed`, `Pending PO Review`, `Accepted` |
| Tracker | Returned bug: move to `Ready for Fix` | Ask in chat first |
| Tracker | `In Refinement` -> `Ready for Development` | Ask first (refinement Step 6) |
| Tracker | Comment on a work item | The project rule says ask before any comment. A skill step "show the draft, post after approval" keeps that gate (repro comment, post-merge comment, QA-gap comment, returned-bug stop comments). Steps that say "post a comment" (contract-gate failure, escalation to `Blocked`, refinement-complete) post without a separate ask [INFERENCE: the global rule exempts a post a skill directs but names Slack, PRs, and state moves, not comments]. The auditor reviews the text either way (X12) |
| Tracker | Modify state, title, or description outside the autonomous list | Ask in chat. The harness does not prompt for these writes (fallback `allow`) |
| Tracker | Create a work item (Bug from a finding, split-off story, scan Bug) | Show the draft, create after approval, re-fetch, link `Related`, re-fetch |
| PR | Open a PR outside a workflow that authorizes it | Ask |
| PR | Post a review comment or a thread reply | Draft in chat. The author approves: one by one for a review, once for the set in `/comments` |
| PR | Vote | Never without explicit approval. On someone else's PR check auto-complete and the last blocking policy first |
| PR | Complete (merge) | `/pr-merge` only, after the one combined ask. Never `bypassPolicy` |
| PR | Arm auto-complete | After a required reviewer is confirmed, or inside the `/pr-merge` ask |
| PR | Push after review-comment fixes or after a conflict resolution | Ask before the push, with evidence first |
| PR | Set a thread status | Only on a thread you started, with approval. Never Fixed, Closed, or WontFix on another person's thread. The one exception is the next row |
| PR | Close another person's thread at merge time (`pr-merge` only) | Inside the one combined ask: `superseded` threads, and chit-chat threads the author marks Close. Then re-list and confirm Closed |
| Slack | Any post except the PR-open line | Fenced draft, then "send it". Includes DMs and the open-PR list. Never secrets, tokens, or `.env` contents |
| Vault | Write outside the three cases in R61 | Not allowed. A statement of fact is not a write request |
| Vault | Promote an inbox task to todo; close a task as done | Ask (show the list or the merged PR) |
| Local | `az login` | Ask (it opens a browser) |
| Local | Restart the Docker VM | Ask |
| Local | Start a service with a direct `hub` or named bash start | Explicit approval in the conversation. The default is the `services` tool |
| Local | Delete task folders, worktrees, or strays | Ask once after the report. `--force` needs an instruction naming the folder |
| Local | Run `env` or `printenv`, run Python code that reads the environment, run or tamper with the TOTP helper, overwrite an unmanaged dotenv file, name the shared test-credential file in a non-read tool | Harness confirm dialog (`harness/extensions/global/guardrails.ts`) |

### 6.4 Autonomous actions (no prompt)
| Area | Action | Condition |
|---|---|---|
| Reads | Tracker, vault, Slack, git, files inside the tasks folder, CI, logs | Always. Fetch live. Never from memory |
| Tracker | Area path, iteration path, assign to self, `/rev` test | The harness allow rule matches only these paths. One extra field falls through to ask |
| Tracker | `New` -> `Ready for Triage` | Bootstrap Step 5, skill-directed |
| Tracker | `Ready for Triage` -> `Ready for Fix` | After reproduction. A returned bug asks |
| Tracker | `Backlog` -> `In Refinement`, `Ready for Development` -> `In Development`, any -> `Blocked`, back to `In Refinement` on a failed contract gate | Skill-directed |
| Tracker | `Ready for Fix` -> `Resolved` (Bug), `In Development` -> `Ready for Test` (Story) | Every linked PR Completed. Re-fetch the PR statuses first and record them. The workflow skills write it with no prompt. `pr-merge` and `morning-brief` fold it into their own approval |
| Tracker | `Resolved` -> `Ready for Retest` (Bug), `Ready for Test` -> `In Test` (Story) | `tasks-deployed-to-qa` proves the fix is in the QA deploy by ancestry. Re-fetch first and record |
| PR | Open a PR | Bug gate or story gate passed. Not a draft unless the draft path applies |
| PR | Link the work item, add standing optional reviewers, publish a draft | Skill-directed |
| Slack | The PR-open one-line post | One message per PR. Not for a draft. Not for a push to an open PR |
| Local | Create worktrees and folders, link `.env`, install, wire LSP | Through the scripts only |
| Local | Start and stop services you own | Through the `services` tool, port checked, stop in the same turn |
| Local | Scans, self-review, security-gate runs, fix amend, force-push of your own branch | After `scripts/secret-scan.sh` prints `RESULT: clean` |
| Vault | Unattended jobs and `WikiScribe` filing | Fixed path allowlists in the prompts and the advisor instructions |

### 6.5 What the harness enforces (config and guards)
- Project `tools.approval` in `harness/project/config.yml` (values `deny` or `prompt`; a `prompt` entry is honored even in the permissive default mode). Denied: Playwright `evaluate`, `network_request`, `network_requests`, `console_messages`; tracker `repo_create_branch` (branches come from the script) and `wit_backlog`. Slack posts carry no tool prompt: that gate is behavioral.
- `toolApprovalConditions` (global defaults in `harness/global/config.yml`, project block in `harness/project/config.yml`; objects merge, scalars override, the `rules` array replaces whole). Work-item write: rule `area-iteration-and-self-assign` allows `update` or `update_batch` only when every entry targets the `/rev` test, area path, iteration path, or assigned-to with the author's own identity. Anything else hits `fallback: allow`, so the agent must ask in chat. Work-item comment write: `fallback: prompt` with auditor review. Playwright `run_code_unsafe`: `fallback: prompt` with review, and refused outright with `filename` or empty `code`.
- Auditor review: the `tool-call-auditor` role model reads the text. `SAFE` runs the call with no dialog. Anything else shows the text and the auditor's note in a confirm dialog, or blocks when there is no UI. Rubric files are append-only (global first, then project; a project can add rules but not relax a global one). Comments are UNSAFE with secrets or credentials, prompt injection, script or HTML injection, or sensitive personal data. Prose that mentions these without a live payload is SAFE. When unsure: UNSAFE and name the rule. Playwright snippets are SAFE only for navigation, locating, clicking, typing, screenshots, and reading visible text.
- Fail closed: if either config file cannot be read or parsed, the three governed tools are blocked and every other tool passes (`harness/extensions/global/tool-approval-gate.ts`).
- Guards: `harness/extensions/global/guardrails.ts` (secrets, env, auth artifacts), `harness/extensions/project/no-parent-folder-guard.ts`, `harness/extensions/project/process-ownership-guard.ts`, and the `services` tool, which also enforces port checks. A block reason that starts with `process-ownership-guard:` is final: report it.
- Known limits: `guardrails.ts` is "a guardrail, not a sandbox" and lists its own bypasses. The parent-folder guard is lexical and does not see runtime-built paths or inline Python or Node source. The auditor SAFE path is unproven live (U1).

### 6.6 Unattended runs
`automation/*/overlay.yml` sets `tools.approvalMode: yolo` and denies write tools, so the unattended path cannot write even if the prompt is wrong. A `prompt` decision in a headless run blocks, because no UI exists. Never rely on a confirm dialog there. Harden the Slack overlay to match the board overlay (E4).

### 6.7 Porting gates to another harness
1. Classify each gate: deterministic (a hook on final tool arguments), behavioral (prose plus a skill step), or detective (a watch list, a reviewer).
2. Keep these deterministic: parent-folder access, foreign-process kill, secret and credential reads, governed tool writes (work-item write and comment, free-form browser code).
3. Keep draft-before-post, state-move triggers, and the combined merge ask behavioral, and re-fetch to prove them.
4. Keep the fail-closed default for governed tools. Give every deny a recorded reason (H5).
5. Test each gate with a negative control in a fresh session before the first autonomous run (Section 9.8).

### 6.8 Changing a gate
When a human changes a rule more than once, the first version was a guess: ask why before the next edit (the bug state order changed three times in five weeks; the vault write path changed three times in three days). After any gate change, search the pack for the old wording including plain-word synonyms, then have a second reviewer pass check the result (Section 8.5).

## 7. Failure modes

All 60 falls recorded in the author's history. IDs are stable labels: A agent behaviour, H harness and tooling, G git and worktrees, S local services, T tracker, P PR and review, Q QA and deploy, C comms, V vault. "Enforcing artifact" is the pack path that encodes the fix. "Not bundled" or "behavioural" means no shipped file carries it (M6). Use this table in audit mode: match the human's recent incidents to symptoms.

### 7.1 Agent behaviour
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| A1 | The agent answers "I don't know, do you want me to check?" to a question a tool could answer | Nothing told it to fetch first | Fetch (code, config, docs, tracker) before answering. Say what was not checked. Ask only when tools cannot answer | `harness/global/APPEND_SYSTEM.md` (Knowledge limits) |
| A2 | Verification ran against a stubbed API. The human demanded the real app | The cheaper mock path was chosen despite a live-verification rule. A rule without a gate gets skipped | A live pass through the real dependency is part of "done". Evidence comes from the running app | `rules/global/BUG_FIXING.md` (section 5), `skills/e2e-verification/SKILL.md`, `harness/project/WATCHDOG.yml` (`default` watch list) |
| A3 | A worker says "done, tests pass" and the orchestrator forwards it | A worker report is a claim. Workers share no context | Read the real diff and test output before any gate. Briefs tell workers to report a blocker instead of fabricating | `rules/global/BUG_FIXING.md` (section 6), `skills/story-workflow/SKILL.md` (Step 3) |
| A4 | An ambiguous instruction was settled by guessing and saying so afterwards. Elsewhere an agent recreated an artifact the human had rejected, or asked "overwrite those files?" about a draft | The agent picked a reading and moved on. Stale intent after a decision. Side questions about destructive actions | Ask one direct question when two readings are plausible. Drop a thread once the human decides. Ask only about what was requested | `harness/global/APPEND_SYSTEM.md` (partly; the rest has no artifact) |
| A5 | A reply opened by correcting an advisor note the human never saw. Reviewer jargon reached the human unchanged | No rule covered unseen sidecar output or relay translation | Never mention advisor notes or steps the human did not see. Translate every subagent and reviewer result into plain words | `harness/global/APPEND_SYSTEM.md` (Communication, Words) |
| A6 | A clean verdict from an advisor or reviewer triggered another round of re-reading and re-testing | The agent treated approval as a prompt to double-check | A clean verdict is terminal. Re-verify only for a new concrete concern or changed code | `rules/global/no-redundant-reverify.md` |
| A7 | In plan mode the agent proposed touching a secret despite an explicit instruction | Plan-mode prompts are compiled into the harness. Rules apply to every mode, but the agent missed it | A plan-mode context hook injects two house rules: never put a secret value in a plan, and every state-changing step names how to verify and how to undo | Not bundled (hook `plan-house-rules`). Copy the two rules into your plan template |

### 7.2 Harness and tooling
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| H1 | Five stream-rule gates (write, PR, Slack, tracker comment, implement-first) stalled autonomous runs. Two misfires in one ticket stopped a session at the plan step | Stream rules abort output at match time in every session type. They are tripwires, not judgment | Removed all five. Gates stay as prose, config prompts, and an advisor that reads the transcript with a model. Hard guarantees move to deterministic hooks | `harness/project/WATCHDOG.yml`, `harness/project/RULES.md`, `harness/extensions/project/no-parent-folder-guard.ts` |
| H2 | A path guard interrupted sessions 37 times in four days (22 in one day) | The rule re-tested the whole partial streamed buffer after each chunk, so a chunk ending in "tas" matched. `--bare` flags and prose mentions matched. Each hit discards partial output and sibling tool calls | Replace it with a `tool_call` hook on final arguments: lexical resolve, `cd` tracking, nested `sh -c` parsing to depth 3. Keep the rule file as prose | `harness/extensions/project/no-parent-folder-guard.ts`, `rules/project/no-parent-folder-repo-access.md` |
| H3 | Stream rules fired on the wrong calls or never fired. A length rule almost never fired. Ticket rules fired on a `grep` | `^` matches only at offset 0 without `(?m)`. `.` skips newlines without `(?s)`. A bare tool scope matches every tool's arguments. First fixes were untested guesses | Scope to `tool:<exact name>`. Add the flags. Test with the harness's rule-test CLI against logged calls. One rule needed 4 revisions before 28 cases verified it | `rules/project/ado-area-path.md`, `rules/project/ado-ticket-voice.md`, `rules/project/pr-thread-resolution.md` |
| H4 | A change had no effect: an extension, setting, command, or skill created mid-session was invisible. One extension failed with "Cannot find package" | Everything loads at process start. The compiled binary resolves deep package imports only through a build-time map. Type-only imports are fine | Restart and verify in a fresh headless run, never in the authoring session. Import only types from the harness package. Port tiny helpers locally. Run child processes from the extension itself | `harness/extensions/global/lib/advisor-config-compat.ts`, `harness/extensions/project/services/index.ts` (own process host) |
| H5 | A browser code tool was blocked with no prompt. A headless worker could not approve it. After a denial with no recorded reason an agent tried a browser sign-in and a PAT `curl` | Two layers denied it, and a comment claimed a third that did not exist. The deny had no reason. Headless runs have no UI | One owner for the prompt (shows the inline code, refuses `filename`). Check both config files on any denial. Record a reason for every deny. When denied, ask or stop; never route around | `harness/extensions/global/guardrails.ts`, `harness/extensions/global/tool-approval-gate.ts`, `rules/project/azure-cli-fallback.md` |
| H6 | Final answers repeated two to three times, each after a hidden "continue" prompt | The unexpected-stop detector classified a finished answer that read like an offer as a stall and re-prompted up to three times | Disable the feature. Restart older processes (settings are read once) | `harness/global/config.yml` (`features.unexpectedStopDetection: none`) |
| H7 | The prose said "ask before modifying a work item" but nothing prompted | Work-item field writes had no `tools.approval` entry. The gate fallback was `allow`. Prose and config disagreed | Write down who enforces what. The agent asks in chat before a state, title, or description write. Review prose and gate config in one pass | `harness/project/RULES.md`, `harness/project/config.yml` |
| H8 | A batch cleanup died at the shell cap after 7 of 14 folders. Four relaunches hit the same cap | Large worktree removal is slow. The `timeout` field was omitted on each retry. `async` does not lift the cap | Pass `timeout` explicitly or start with a name. List what still exists before each retry. The author used batches of 3 to 4 folders (M6) | `rules/project/tool-gotchas.md`, `skills/task-cleanup/SKILL.md` |
| H9 | Scripts crashed only in cron or tests ("unbound variable", or a dialog asking to install developer tools) | macOS `/bin/bash` 3.2 treats an empty array expansion as unbound under `set -u`. A minimal PATH makes `git` the Xcode stub | Guard empty arrays before expansion. Write for bash 3.2. Keep the real git directory on PATH in fail-closed tests. Test under `/bin/bash`. Note: two shipped scripts use `declare -A` and need bash 4 (E2) | `scripts/secret-scan.sh`, `automation/slack-ingest/run.sh` |
| H10 | Playwright MCP calls failed "Browser is already in use". Later `@latest` moved the Chromium revision mid-session. The runner lost its sign-in | Four MCP processes shared one on-disk profile. The version was unpinned. In isolated mode `browser_close` discards the whole in-memory context | `--isolated` per session. Pin the MCP version. Drop `browser_close` from the runner's tools | `agents/flow-runner.md` (no `browser_close`). `harness/mcp.template.json` does not yet pin or isolate (X20) |
| H11 | `grep` said "No matches found" for text that exists. `glob` missed a repo. Agents used shell `ls` and `cat` for reads (31 shell calls in the first six calls of 60 sessions) | Tools treat task-folder repo symlinks differently. No always-apply nudge existed | A per-tool table tested live. `git -C <repo> grep` for whole-repo search. An always-apply `read` rule that reaches subagents | `rules/project/tool-gotchas.md`, `rules/global/read-tool-first.md` |

### 7.3 Git and worktrees
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| G1 | `--force-with-lease` failed "stale info". `origin/<branch>` was an unknown revision. `git fetch origin main` never moved `origin/main`. `git push -u` exited 128 although the push worked | Worktrees of a bare clone have no fetch refspec and no remote-tracking ref for a new branch | Fetch with an explicit refspec. Push with `--force-with-lease=<branch>:<sha>`. Confirm a push with `git ls-remote`, not the exit code. Scripts fetch with explicit refspecs and guard a missing base | `scripts/self-review.sh`, `scripts/secret-scan.sh`, `skills/ticket-triage-profile/SKILL.md`. The lease form and the `ls-remote` check are not written in a skill (M6) |
| G2 | After `git stash` during a merge conflict, `stash pop` dropped `MERGE_HEAD`. The merge state had to be rebuilt by hand | Stash interacts badly with an in-progress merge | Never stash during a merge or rebase. Merge the target into the branch. Never rebase or force-push a shared branch | `skills/merge-conflict/SKILL.md` (merge, never rebase). The stash ban is not written there (M6) |
| G3 | Rerunning the wiring script created the branch in every bare repo that lacked it, including out-of-scope repos. Stale registrations blocked recreation. Later an agent deleted the branches, worktrees, and symlinks of out-of-scope repos that the author needed | The script globbed every `*-bare` repo with no exclusion concept. Tidy-up habit | Standing exclusions live in the script's `excluded_repos` array, skipped before any git work. After setup never remove a symlink, branch, or worktree. Recover stale registrations with `git worktree prune` | `scripts/setup-task-branch.sh`, `harness/project/RULES.md`, `skills/ticket-bootstrap/SKILL.md` (Step 4) |
| G4 | A PR review in a reused worktree showed the old tip | Reuse checked out the cached local branch, not the fresh fetch | In PR mode only: force-update the local ref to the fetched head and hard-reset an existing worktree. Verify the head against the PR's last merge source commit | `scripts/setup-task-branch.sh` (`--pr`), `skills/pr-review/SKILL.md` (Step 3) |
| G5 | A subagent wrote `../plan/...` from a repo symlink and created a folder beside the bare-repo worktree, outside the tasks folder | The shell resolved the symlink before applying `..` | Subagents get absolute task-folder paths. The parent-folder guard blocks the rest | `harness/extensions/project/no-parent-folder-guard.ts` |

### 7.4 Local services
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| S1 | The health check was green but the stack served another branch's code. The first flow run was void | Concurrent stacks cross-wire through hard-coded localhost ports. `hub restart` reuses the stored launch spec, including a stale cwd and env. A lifecycle agent started in the wrong worktree | Prove the served build: `lsof` the PID's cwd, `curl` one source module, check fallback ports. `stop` then `start` fresh whenever the spec changes. Serialise live verification across tickets | `skills/service-startup-reference/SKILL.md` (cross-wiring), `skills/flow-schema/SKILL.md` (Step 3), `agents/error-detective.md` |
| S2 | `hub start` timed out waiting for a dev server that was serving pages | The dev server binds the IPv6 loopback. The readiness probe checked IPv4 only | Log-regex readiness only. `curl` the `localhost` hostname as proof | `harness/extensions/project/services/plan.ts` (web-app `ready.log`) |
| S3 | Debugger attach timed out against a listening port. The adapter helper outlived `hub stop`. The debugger saw no child process | The readiness connect-and-close used up debugpy's single client slot. debugpy double-forks its helper to PID 1. `--reload` forks a child the debugger cannot see | No `ready` gate in debug mode: use a passive `lsof` check. After stop, find the helper by `lsof`, verify parent 1 and the command pattern, then kill it. Launch through the venv's uvicorn, not a reloading entry point | `harness/extensions/project/services/plan.ts`, `harness/project/dap.json`, `skills/service-startup-reference/SKILL.md` |
| S4 | A service agent killed a process another task owned. Later bypasses: `kill $(lsof -ti :PORT)` and stale ledger entries | "Never stop a foreign process" was prose only. The shell splitter left a bare `kill` with no literal PID | Code enforcement: an ownership ledger keyed by process name. Block `pkill`, `killall`, `xargs kill`, and any `kill` without a literal PID. The human stops foreign orphans. The `services` tool refuses `*-bare` and non-symlink paths | `harness/extensions/project/process-ownership-guard.ts`, `rules/project/services-via-services-tool.md`, `harness/extensions/project/services/index.ts` |
| S5 | Services started but did not talk to each other. A first start failed on a database timeout. A fresh worktree failed `uv run pytest`. Two tests failed only with the shared env file | Sibling-URL overrides must use the prefixed variable names (an unprefixed name is accepted and ignored). The shared env pointed the agent at its own port. The database container was not running. The test dependency group was missing | Pass sibling overrides on the command line with exact prefixed names and read the startup log's printed URL as proof. Start the database container first. `uv run --group test pytest`. Set the two env overrides for the full suite. `pnpm install --frozen-lockfile` before the web app | `harness/extensions/project/services/plan.ts`, `skills/service-startup-reference/SKILL.md` |
| S6 | Every image-generation call returned 401. A PAT check returned 302 for real and bogus tokens. A real model-gateway key hung past 60 s on a probe | A dead shared key with no rotation record. Probes without a control cannot discriminate. The PAT variable holds base64 `user:pat`, a ready-made Basic credential | Preflight probes need a control (a bogus credential must fail in the expected way). Send the PAT as a Basic header. Escalate dead keys to the owner. A script that prompts before work gets rejected | Behavioural (the preflight script was deleted at the author's request). The Basic-header fact is in `harness/project/AGENTS.md` |
| S7 | A Playwright browser and dev servers stayed running after the PR. Orphan helper processes | No teardown step | Teardown after verification: close browser tabs, stop only what this session started, then an orphan check. Leave nothing running that was not running before | `rules/project/no-orphan-processes-after-use.md`, `rules/project/teardown-verification-tooling-after-pr.md`, `skills/bug-workflow/SKILL.md` (Step 4) |

### 7.5 Tracker
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| T1 | A write "succeeded" but the data was wrong: angle-bracket tags came back as empty backticks. `transitionWorkItems: true` did not move the bug. A reviewer added through the API was optional only | Tool layers strip or ignore fields. A response reports the call, not the state | Re-fetch after every write and check the field. Write tag names without brackets. Never rely on `transitionWorkItems`. Record the re-fetched value | `harness/project/RULES.md`, `skills/pr-and-team-comms/SKILL.md`, `skills/ticket-triage-profile/SKILL.md` |
| T2 | Work-item reads failed with "Client does not support form elicitation" in unattended runs | The MCP asks for a project when `project` is omitted. A headless run has no human | Always pass `project` explicitly | `rules/project/tool-gotchas.md`, `automation/board-ingest/prompt.md` |
| T3 | A state write returned HTTP 400 although the transition matrix allows all-to-all. A new story landed on `Backlog`, not `New` | Jumps fail in practice. The process template sets its own defaults | One neighbouring state per write. Derive the ladder from `get_type`. Re-fetch after a type change | `skills/ticket-bootstrap/SKILL.md`, `harness/project/AGENTS.md` |
| T4 | A ticket the tester moved back after a PR was treated as new. Bootstrap would have overwritten a real state such as `Bug Test Failed` | No branch for returned tickets | Step 0 for returned bugs: detect a state other than New or Triage, or a linked PR. Read comments since the last move. Reproduce on current code including the merged fix. Write a plan that says why the first fix failed. Skip the state write | `skills/bug-workflow/SKILL.md` (Step 0), `skills/ticket-bootstrap/SKILL.md` (Step 1b) |
| T5 | "Who touched this?" answers were wrong. A board query on the wrong field failed | A "changed by me" query returns only the last editor. The board is an area path, not an iteration path | Attribute through revision fields (changed by, resolved by, closed by), not dates. Query the area path | `skills/morning-brief/SKILL.md`, `skills/daily-work-poll/SKILL.md`. The actionable-bug criteria note is not bundled (M6) |
| T6 | An artifact download through the MCP "succeeded" with a 0-byte zip. List and get calls failed "Failed to find api location for area". Seven stray report folders piled up at the tasks root | The MCP artifact download is broken for this report type. `az login` does not satisfy the extension's artifact tool. One API area was unavailable. No folder convention existed | CLI fallback with `az devops login` plus PAT, downloading into the task folder, never the tasks root. Log "unresolved" instead of guessing a repo name. CLI only for login after an MCP failure, or when no MCP tool exposes the action | `skills/checkmarx-handling/SKILL.md`, `rules/project/azure-cli-fallback.md`, `skills/task-cleanup/SKILL.md` (strays) |

### 7.6 PR and review
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| P1 | A PR auto-merged unreviewed within about 15 seconds and moved the bug to Resolved. The reviewer could no longer be marked required. `main` had to be reverted by hand | `update_reviewers` can only add optional reviewers. Auto-complete was set right after. No policy required an approval | Mark the reviewer required (CLI), re-fetch, and only then set auto-complete. Keep branch policy as the real gate (a tool-level PR prompt was later removed on request, so policy must carry the weight) | `skills/pr-creation/SKILL.md`, `skills/pr-and-team-comms/SKILL.md` |
| P2 | An `Approved` vote on a colleague's PR merged it at once | Their auto-complete was armed and the vote satisfied the last blocking policy. A vote and a merge are different acts | Before voting on someone else's PR check `autoCompleteSetBy` and the live policy evaluation. If the vote would complete the PR, ask first | `harness/project/RULES.md`. `skills/pr-review/SKILL.md` does not repeat the vote check (M6) |
| P3 | The agent marked another reviewer's thread `Fixed` | It assumed it could resolve what it fixed | Push the fix, reply with the commit, leave the thread `Active`. Only the author resolves it | `rules/project/pr-thread-resolution.md` |
| P4 | Review drafts included code patches the author did not want. A thread anchored outside the diff never rendered. Comments carried incidental build ids and links. A proposed fix still left the hole | Anchors must sit on diff lines. The first scope rule was worded more broadly than its cause | The comment names the problem. Add a small fix only where no design choice is needed, with no code comments in it. Anchor in a changed file; the text may name an untouched file. Strip incidental external data. Check a fix against the real failure mode | `skills/pr-review/COMMENT-STYLE-NOTES.md`, `skills/pr-review/SKILL.md` |
| P5 | Review lanes over-claimed: a test assertion called vacuous, a change said to reach templates it does not. A lane that ran tests broke its read-only contract | Lanes are models reading partial context | The main agent reads the diff first and checks each lane claim against code before repeating it. The quality lane checks that a mutation-check record exists instead of running tests | `skills/pr-review/SKILL.md` (Step 6), `agents/architect-reviewer.md` |
| P6 | A PR with a green build could not auto-complete. A fresh pipeline run did not satisfy the policy | `main` moved, so the policy build expired. A plain pipeline run does not attach to the policy evaluation | Classify the build against `main`'s tip: passed, failed, stale, running, no run. Re-queue through the policy action (not a new run), poll, then re-read the policies | `skills/my-pr-status/SKILL.md` (Step 2a), `skills/pr-merge/SKILL.md` (Step 3d) |
| P7 | Merging `main` into a branch silently retired part of an already-shipped fix (two designs for one symptom) | Both designs touched the same files. The merge kept one | State the trade-off in the PR and ask a human to confirm before merge. Prove the net change with a pre and post patch diff. Regenerate lockfiles instead of hand-merging them | `skills/merge-conflict/SKILL.md` |
| P8 | A secret-scan allowlist had no effect and gave no warning | A global allowlist with rule targeting is ignored when the default rules are extended | Use a rule-scoped allowlist block. Give every scanner config a smoke test: one case that must fire and one that must pass. Only the security subagent may rule a hit false-positive | `scripts/gitleaks.toml`, `skills/pr-security-gate/SKILL.md` |

### 7.7 QA and deploy
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| Q1 | Unit tests passed but the fix did nothing in the browser | The mock assumed a library rejects on abort. The real one resolves, so code that checked only in `catch` never ran. A dev proxy also swallowed the browser abort | Verify against the real dependency once. Reproduce at the real failure boundary (call the backend directly, kill the connection at a low level). Check the abort flag after the call returns | `rules/global/BUG_FIXING.md` (sections 1 and 5) |
| Q2 | A transient UI state (a 1.5 s highlight) could not be captured. Two flow runs were inconclusive | Screenshot timing against a short tint | Observe the resting layout in the flow. Measure transient states with a throwaway spec that uses the repo's mocked API | `skills/flow-schema/SKILL.md` |
| Q3 | A model-behaviour fix looked proven after one run | Behaviour is probabilistic. A per-run memory reset was undone by a background job | The baseline on `main` must reproduce (gate: at least 1 of 15 runs, otherwise stop). Repeat runs per prompt. Reset again after background jobs settle. Include control prompts that must still call the tool. Add a catalogue rule such as `tools_never` | `skills/regression-test-placement/SKILL.md` (single live run only). The baseline gate and repeat runs are not written there (M6) |
| Q4 | Verification could not run as named (an infrastructure plan needed CI-injected values). A contract claimed no nightly test pack exists, but one did | Missing access. Contract facts about the repos were not verified before the contract was written | A stop condition: raise it, and record the weaker check as a waiver, not an accepted risk. Verify contract claims with `git grep` on `origin/main` of every repo before refinement ends | `skills/story-refinement/SKILL.md`, `skills/story-workflow/SKILL.md` (stop conditions) |
| Q5 | A QA page redirected after a good login. A test login failed (wrong tenant). MFA prompts varied between runs. Dev was unreachable from the laptop. The page count of a generated document could not be measured | Role gates. The test account lived in another tenant. Sign-in prompts are conditional. Dev sits behind a private endpoint. The Word automation was denied | Ask for the role before bug work. Use a same-tenant test account with TOTP through a CLI. Mark conditional login steps. Record "dev: not reachable from this host" or run through pipeline agents. Leave page counts to a human | `skills/e2e-verification/SKILL.md`, `skills/post-merge/SKILL.md` |

### 7.8 Comms
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| C1 | Reports showed vote integers, merge-status codes, thread ids, and hashes. The author complained on three separate days | No rule translated tracker codes. The vote fix landed only after the third complaint | A vocabulary table in the constants file (PR status, merge status, thread status, vote words). Use UI words ("Resolved", not the API's "fixed"). One raw anchor at most; the rest goes into a saved doc | `harness/project/AGENTS.md` (Vocabulary), `skills/my-pr-status/SKILL.md` (Step 4), `harness/global/APPEND_SYSTEM.md` |
| C2 | Dense status dumps. Undefined labels ("step 3e", "the THREADS file"). A daily "what did I do yesterday" re-orientation | Length was not the cause. Undefined internal labels and identifiers were | Verdict or state first, labelled sections, one decision at the end. Define a coined label on first use. A recap shape and the morning brief | `harness/global/APPEND_SYSTEM.md`, `skills/morning-brief/SKILL.md`, `skills/daily-work-poll/SKILL.md` |
| C3 | Slack drafts and ticket comments carried background, fixes, emoji, and sign-offs. PR descriptions repeated "Fixes N", "suite passing", and "live-verified" | No rule covered draft content. "Never shorten a draft" was read as permission to add | Drafts say exactly what was dictated. A forbidden-wording table in PR creation. A plain first-person ticket voice | `harness/global/APPEND_SYSTEM.md` (Drafts), `skills/pr-creation/SKILL.md`, `rules/project/ado-ticket-voice.md` |
| C4 | A Slack post collapsed into one line. Links did not render. The tool has no edit or delete. A PDF could not be read | Markdown content type is not rendered. Links need rich-text `link` elements. The tool lacked file download, and the token lacked `files:read` | Post with a `blocks` rich-text payload. Test a new format in a DM first. Show the message text, not JSON, in the approval dialog. Download files by hand into a docs folder | `skills/pr-and-team-comms/SKILL.md`, `skills/my-pr-status/SKILL.md` (Slack section) |
| C5 | The author repeatedly said "do not prompt me when everything is in order" (state moves, opening the PR, the PR-open notification) | The gates were followed as written. They always got "yes" | Turn always-yes prompts into fact checks. Skill-directed moves need no prompt. The PR opens once the verification gate passes. The PR-open notification posts without a draft. Keep approval for posts that have an audience | `harness/project/RULES.md` (exceptions), `skills/pr-and-team-comms/SKILL.md` |

### 7.9 Vault
| ID | Symptom | Cause | Prevention | Enforcing artifact |
|---|---|---|---|---|
| V1 | The vault write path changed three times in three days (a subagent per write, then an advisor owns writes, then the main agent writes directly). The decisions were never reconciled | Each change fixed the last pain without naming the owner of the contract. Circularity, idempotency after a context reset, and approval stalls stayed open | Pick one owner and write the exceptions. The scribe advisor files durable facts. The main agent reads for context and writes only on an explicit request or a blocker. Keep scope boundaries in the advisor's own instructions | `vault/schema.md`, `harness/global/WATCHDOG.yml` (`WikiScribe`) |
| V2 | A missing vault write-back was noticed days later. A follow-up turn summarised its own summary. `end_session` left the process alive for 20 minutes. A fact stated in the closing message was not filed | The check ran at "concern" severity (a silent card after a terminal answer). Follow-up turns re-summarised. The deferred shutdown flag was never consumed. The exit gate runs mid-turn, before the scribe reviews | Use "blocker" severity. The follow-up turn starts with a one-line note, then copies the prior result verbatim. Drive the exit from the `turn_end` hook. State the fact one turn before the close | `harness/extensions/global/end-session.ts`, `harness/extensions/global/advisor-drain.ts` |
| V3 | Advisor cost: 6,991 per-turn reviews cost about $265 in 14 days and 83% made no tool call. One advisor commented on topics outside the vault | Review cadence per tool round. A shared "raise a concrete concern" permission applied to a single-domain advisor | `reviewMode: agent-end` with a capped final wait (about 9 times fewer reviews). Do not switch to a smaller model whose context 15% of reviews exceed. Put scope precedence in the shared file and in the advisor's own instructions | `harness/global/config.yml` (`advisor.reviewMode`), `harness/global/WATCHDOG.md`, `harness/global/WATCHDOG.yml` |
| V4 | Stale wikilinks after a rename showed as empty placeholder nodes. An edit at a stale line number can delete a neighbouring log header | The log is append-only, so old links cannot be fixed without an exception. Edits used line numbers from an old read | One user-approved exception. Append only after reading the last lines. Copy the exact `[path#TAG]` header from the last read. Never insert at a line number from an old read | `vault/schema.md` |
| V5 | Retiring a policy: markers had been stamped across 223 files. A blind regex strip corrupted instruction prose. Line-by-line matching missed markers that wrap. Memory files kept telling future sessions to apply the policy. A `cp` loop silently dropped lines | Mechanical edits over instruction text. The policy was restated in memory and in generators | Hand-edit instruction and generator files. Match whole text. Verify with plain words as well as the glyph. Update memory. After applying staged diffs, compare the live files with the diff the human approved | Behavioural (no pack artifact) |
| V6 | A note claimed a Monday multi-day catch-up that the script never had, and two days were lost. A test run dated one day ahead left a guard line, so the first real run skipped | Documentation described intended behaviour. A verification used the real vault with a future date | The script reads the vault's own guard lines and backfills every missing day, oldest first (cap 21 days, per-day cap 20 minutes). A day with a raw file but no guard line is skipped as "needs manual reconciliation". Test in a sandbox copy with a stub | `automation/slack-ingest/run.sh`, `automation/board-ingest/prompt.md` |

## 8. Known contradictions and gaps

The pack keeps the author's skills as written. The clear-cut contradictions the author's audits found are already fixed in the shipped files; the rows below are the ones that need a human or design decision. Decide every item below in your installed copy before the first autonomous run, and record each decision in one place (the constants file). Never carry a contradiction forward silently. "D" numbers (D1 to D22) are the author's own labels for drift items; they are labels only and are not defined elsewhere in the pack. Each item below was checked against the shipped files.

### 8.1 Contradictions between shipped files (you MUST fix or decide)
| ID | Where | What disagrees | Prefer | Action |
|---|---|---|---|---|
| X1 | `commands/story.md`, `skills/story-workflow/SKILL.md` (Steps 0 and 1) | The command sends "Ready for Development or later" to Session B and Step 1 describes a resume, but Step 0 passes only on exactly `Ready for Development` and otherwise moves the story back to `In Refinement`. A resumed story in `In Development` would be demoted | One place decides routing. The skill's gate text wins for a fresh start | Decide how a resume (an existing `STORY-<NUM>-*` folder) skips the gate, write it in Step 0, and have the command pass the state to the skill (D1) |
| X3 | `skills/ticket-bootstrap/SKILL.md`, `skills/merge-conflict/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md` (Step 5), `skills/ticket-triage-profile/SKILL.md` (Code locations), `skills/story-refinement/SKILL.md` (Step 2), `skills/daily-work-poll/SKILL.md` (Step 4), `skills/repo-onboarding/SKILL.md` versus `rules/project/no-parent-folder-repo-access.md` and the guard | Six skills run git or read files inside the `-bare` parent folder, which the rule forbids and the guard blocks. `repo-onboarding` must write there to create a clone | Task-folder symlinks and the dedicated `main` reference folder inside the tasks root | Rewrite the six. Decide how onboarding runs: a human step, or a session started outside the guarded root (D3) |
| X11 | `skills/pr-review/COMMENT-STYLE-NOTES.md` versus `harness/global/APPEND_SYSTEM.md` (Drafts) and `skills/pr-review/SKILL.md` | The notes say to include a proposed-fix block when the fix is small. The global rule says a review comment names the problem and gives no fix unless asked | One rule: no fix unless asked. When asked, a small contained fix is a code block with no code comments, and a design decision stays a question [INFERENCE: the sources do not settle it] | Confirm with the human |
| X12 | `harness/project/RULES.md` versus `harness/global/RULES.md` | Project: ask before any work-item comment. Global: a post that a loaded skill directs needs no draft and no approval (it names Slack, PRs, and state moves). Story skills direct comments (gate failure, escalation, refinement-complete). Bug and post-merge skills direct draft-then-approve | A skill-directed comment is pre-approved. A "show the draft" step is gated. The auditor reviews every comment either way | Write the rule once with its exception list |
| X20 | `harness/mcp.template.json` versus `skills/flow-schema/SKILL.md`, `agents/flow-runner.md` | The template launches Playwright as `@latest` without `--isolated`. The skill says to keep the version pinned and the browser isolated | Pin and isolate (H10) | Edit the template entry. Consider pinning the other servers too |
| X23 | `skills/bug-workflow/SKILL.md` (Step 7), `skills/pr-merge/SKILL.md` (Step 6), `automation/board-ingest/prompt.md` (Step 7), `harness/project/AGENTS.md`, `skills/tasks-deployed-to-qa/SKILL.md` | State-move triggers are written in several places. `pr-merge` and `morning-brief` cite the board prompt's table as the proposal table | One home per fact (D10, D21) | Keep one ladder note plus `get_type`. Skills hold only triggers |

### 8.2 Missing from the pack (create or drop)
| ID | Missing | Needed by | What to do |
|---|---|---|---|
| M1 | `lsp-tooling/package.json` and `lsp-tooling/pnpm-lock.yaml` | `scripts/setup-task-lsp.sh` copies them from beside itself. `scripts/cleanup-task-folders.sh` keeps a `lsp-tooling` entry | Create a pinned package that installs the language servers the script looks for (`pyright-langserver`, `typescript-language-server`, `typescript/lib/tsserver.js`) [INFERENCE from the paths in the script], then generate a lockfile |
| M2 | Vault notes `notes/flow-schema.md` and `notes/ui-map.md` | `skills/flow-schema/SKILL.md` and `agents/flow-runner.md` tell the agent to read them first, every time. The skill states the `flow.yaml` rules. The `result.yaml` shape and the page-label map appear nowhere in the pack | Write the schema note from the skill rules and the runner contract. Define `result.yaml` (flow path, env, expect, base URL, sha, viewport, auth, auth handoff, verdict, per-step matched and citation), or the runner has no output contract. Build the UI map from the human's app source |
| M3 | `docs/PAPERCUTS.md` | `harness/project/AGENTS.md` | Create an empty log with the row shape: date, symptom, fix, project |
| M4 | Decision page `decisions/2026-09-16-bug-state-stays-ready-for-fix-until-merge.md` | `automation/board-ingest/prompt.md` cites it | Write a decision page or remove the citation. The rule itself is in `skills/bug-workflow/SKILL.md` (Step 7) |
| M5 | Vault pages: a `[[team-tasks]]` catch-all project, `projects/infra.md` with tenant and subscription ids, a client org page whose `slack_channels` matches the runner | `automation/slack-ingest/prompt.md`, `rules/project/azure-cli-fallback.md`, `harness/project/AGENTS.md`, `automation/slack-ingest/run.sh` | Create them from `vault/templates/project.md` and `vault/templates/org.md`. The pack's example vault holds fictional pages only |
| M6 | Lesson fixes that live only in history: G1's `--force-with-lease=<branch>:<sha>` form and post-push remote-ref check, G2's no-stash rule during a merge, Q3's baseline gate (at least 1 of 15 runs on `main`, repeat runs per prompt, control prompts, memory reset after background jobs) and the plan template that carried it, A7's plan house rules, T5's actionable-bug criteria, H8's cleanup batch size, S6's control-probe rule, P2's vote check and P3's thread-status rule in `skills/pr-review/SKILL.md` | The Section 7 rows that cite M6 | Add each to the skill the row names. Mark anything you do not verify `[INFERENCE]` |
| M7 | Out by design or scope: real `mcp.json`, the shared test-credential file, `.env` files, the `tdd` skill from the author's roster, an employer-specific model-provider shim extension, the `swarm-extension` package that `harness/global/config.yml` loads, a vault README | Contract and scope | Never recreate secrets. Drop or replace the rest |
| M8 | External prerequisites the skills assume: a `Check for linked work items` branch policy, required-reviewer policies, per-repo PR and deploy pipelines with the trigger patterns named in `skills/deployed-version-check/SKILL.md`, a scan stage in CI, `docker-compose.local.yaml` in the orchestrator repo (the `services` tool runs `docker compose -p orchestrator-local-mongo -f docker-compose.local.yaml up -d --wait mongodb`), a `.out-of-scope/` folder convention that triage scouts read | The skills named | Verify each exists in the human's tracker and repos before enabling the skill that needs it |

### 8.3 Environment-specific residue and portability traps
| ID | Item | Where | What to do |
|---|---|---|---|
| E1 | macOS-only commands | `stat -f`, `date -v`, `date -j` in `scripts/cleanup-task-folders.sh` and `automation/slack-ingest/run.sh`; `/Applications/...` browser paths in `scripts/setup-task-lsp.sh`; Colima in `harness/extensions/project/services/index.ts` | Port for Linux (`stat -c`, GNU `date`) or keep macOS |
| E2 | Bash version | `declare -A` in `scripts/setup-task-lsp.sh` and `scripts/cleanup-task-folders.sh` needs bash 4 or newer. macOS `/bin/bash` is 3.2. `scripts/setup-task-branch.sh`, `scripts/self-review.sh`, and `scripts/secret-scan.sh` avoid it | Put a newer bash first on PATH or rewrite the two scripts. Keep the cron runners and the secret scan bash-3.2 safe (H9) |
| E3 | Hard-coded topology | `SERVICES` table in `harness/extensions/project/services/plan.ts`, port and module maps in `scripts/setup-task-lsp.sh`, `excluded_repos=(legacy-agent)` in `scripts/setup-task-branch.sh`, the files in Section 3.2 | Edit them together and update `harness/extensions/project/services/plan.test.ts` |
| E4 | Automation inconsistencies and fixed values | `automation/README.md` says the Slack job installs daily at 08:30 (`automation/slack-ingest/install.sh` default `30 8 * * *`). `automation/slack-ingest/run.sh` says the real entry is weekdays 11:00. `automation/board-ingest/prompt.md` says the board job runs at 10:15 and the Slack job at 11:00 (its "Vault inbox" section depends on that order). `automation/slack-ingest/overlay.yml` denies 6 write tools, `automation/board-ingest/overlay.yml` denies 8: the Slack overlay lacks `mcp__azure_devops_wit_work_item_comment_write` and `mcp__azure_devops_repo_create_branch`. Both runners hard-code `OMP_BIN` (`$HOME/.bun/bin/omp`), `VAULT_DIR` (`<VAULT_ROOT>`), a model id, and the installers use a zsh login shell | Pick one schedule and make the three places agree. Make the Slack overlay deny at least what the board overlay denies. Parameterize the paths |
| E5 | Identity-provider specifics | `skills/e2e-verification/SKILL.md` login steps (button labels, a "don't ask again for 90 days" tick, conditional prompts). `automation/playwright/config.json` and `automation/playwright/windows-client-hints-init.js` spoof a Windows Chrome user agent and client hints. `automation/README.md` says to check your own policy before reuse [INFERENCE on purpose] | Re-derive the login steps for the human's provider. Do not copy the user-agent spoof without the human's explicit approval and a check of the provider's policy |
| E6 | Model ids and roles | `agents/pr-security.md`, `harness/project/WATCHDOG.yml`, `harness/global/WATCHDOG.yml`, `harness/global/config.yml`, and both `run.sh` runners pin vendor model ids. Agents use role aliases `@slow`, `@task`, `@smol`. `tool-call-auditor` is a role | Map the tiers (Big, Mid, Small, Auditor) to the human's models |
| E7 | Personal global config | `harness/global/config.yml` mixes needed keys (`modelRoles`, `advisor`, `features`, `toolApprovalConditions`, `vibeExtraTools`) with personal settings (theme, speech, hardware cursor, power, telemetry, marketplace) | Merge only the needed keys |
| E8 | Terminal-specific key bindings | `harness/extensions/global/mode-presets.ts` assumes one terminal and one multiplexer | Skip |
| E9 | Disabled extension | `harness/global/config.yml` lists `extension-module:title` under `disabledExtensions` | Remove the entry to enable `/title` |
| E10 | Stack-specific text | `rules/project/py-runtime-assert.md`, `rules/project/py-log-exception.md`. The PR-build table in `skills/service-startup-reference/SKILL.md`. Catalogue paths, counts, and test-file line numbers in `skills/regression-test-placement/SKILL.md` (the skill itself says the test is the truth and the README counts lag) | Keep for matching stacks. Replace the rest |
| E11 | Dated snapshots | `skills/checkmarx-handling/SKILL.md` ("Known repo state, as of 2026-09-11"), the reviewer snapshot table in `skills/pr-creation/SKILL.md`, per-repo trigger patterns in `skills/deployed-version-check/SKILL.md` | Re-derive from live reads. Never reuse as fact |
| E12 | Author-specific residue | `harness/extensions/global/guardrails.ts` `ALLOW_PATTERNS` holds a path from the author's dotfiles layout. `harness/extensions/project/no-parent-folder-guard.ts` `PROJECT_DIR` is the literal `<PROJECT>`. `scripts/cleanup-task-folders.sh` `KEEP_LIST` names a `remove-marker.sh` that is not bundled [INFERENCE: tied to a retired marker policy] and the script skips branches named `main`, `master`, `fix-asd`. `skills/task-cleanup/SKILL.md` repeats `fix-asd`. `harness/global/APPEND_SYSTEM.md` ends Knowledge limits with a ban on suggesting markers in files [INFERENCE: residue of the same retired policy] | Set or delete each one |
| E13 | Temporary-override rule | `rules/project/ado-area-path.md` describes a temporary board override with a current and a previous value | Keep it as a template for a board switch, or write one stable value |

### 8.4 Unproven claims (do not present as proven)
| ID | Claim | State in the sources |
|---|---|---|
| U1 | `tool-call-auditor` model review | A live smoke test of a cookie read ran with no dialog and the cause stayed open. No automated test exists for either path. No confirmed live SAFE comment post |
| U2 | Local auto-login with `flow-runner` end to end | Not run. A gate meant to confirm writes that name the secrets file did not fire in a live probe |
| U3 | Mode presets on Ctrl+0 to 4 | Plan approved. Execution and key delivery through the terminal and multiplexer not confirmed |
| U4 | `pr-comments` reviewer mode and colleague-branch pickup | Written, not run against a real PR or branch |
| U5 | Returned-bug Step 0, the mutation check, the self-review gate | Recorded as not yet exercised on a live bug when folded in |
| U6 | Pre-PR security gate | The plan lists nine verification steps. The sources do not record their results |
| U7 | The nine communication rules and the `read`-first advisor wording | No live session confirmed a behavior change |
| U8 | `/clear` and manual-compaction return to the launch root | Designed, not run live |
| U9 | Poller framework | Design only. Headless behavior of the approval gates is unknown. Service modes are undocumented. [INFERENCE] a detached mode survives the broker |
| U10 | Vibe mode as the ticket-pipeline vehicle | Wrong vehicle: the director loses shell, MCP, and the `services` tool. A `task` batch in normal mode keeps every tool but forces delegation. `isolated: true` from a folder of symlinks may fail. Proposal only |
| U11 | The reference `main` folder | It is the same working tree other sessions read. Uncommitted manual-test changes there affect them |

### 8.5 Audit and maintenance protocol for an adopter
1. One home per fact: facts in the constants file, procedures in skills, gates in rules plus config, mechanics in scripts, lifecycle in agents and tools.
2. Reference, do not copy. Cite by heading, never by step number.
3. Every decision triggers a repo-wide search for the old wording, including plain-word synonyms, then a second reviewer pass. A default-channel rollout and a path rename each needed it (three more stale skills after the first pass; 56 dangling symlinks in worktrees).
4. Audit on a schedule. One read-only inventory after three months found 23 contradictions between skills. A second audit found 9 side findings.
5. A rules file that contradicts itself is a bug. Keep exceptions in one list.
6. Skills created or changed mid-session do not load. Test in a fresh session. A dry read by a read-only subagent is cheap but can misattribute a quote.
7. Turn each "Known gaps" line in a decision page into a task or an owner.
8. Order edits that share a file. One change renumbered every later line in the author's handoff notes.
9. Verify a documentation claim by reading the target file. Documentation can describe intended behavior (D22).
10. Check the skill roster for hidden duplicates. An older copy in a cache once loaded instead of the current skill.

## 9. Adoption procedure

### 9.1 Inventory the human's current workflow
Do this before you touch the pack. Read; do not assume. Keep the result in a scratch file outside the pack. Never open secrets: list MCP servers by name only, never their config contents.

| Dimension | Read or ask | Pack counterpart |
|---|---|---|
| Harness and version | Which agent harness. Whether it has skills, slash commands with arguments, subagents, hooks, headless mode | Sections 2.2, 2.4 |
| Instruction files | Global and project instruction files, existing skills, commands, hooks, settings (names and structure) | `harness/` |
| Tracker | Which tracker. The state list per work-item type (`get_type` where available). Board and area. Ticket templates. Custom fields | `skills/ticket-triage-profile/SKILL.md`, `harness/project/AGENTS.md` |
| Git hosting and CI | Merge strategy, required reviewers, linked-item policy, PR pipelines, deploy triggers per environment | `skills/pr-creation/SKILL.md`, `skills/deployed-version-check/SKILL.md` |
| Repo layout | Repos, languages, how services start, ports, test commands, a database dependency | `skills/service-startup-reference/SKILL.md`, `harness/extensions/project/services/plan.ts` |
| Session habits | Where sessions start. Parallel tickets. Branch and worktree practice | `scripts/setup-task-branch.sh`, `harness/project/RULES.md` |
| Review and merge | Who reviews. Use of auto-complete. Comment conventions | `skills/pr-review/SKILL.md`, `skills/pr-merge/SKILL.md` |
| Testing | Where regression tests go. Whether a mutation check or live check exists. UI flows | `skills/regression-test-placement/SKILL.md`, `skills/flow-schema/SKILL.md` |
| Security | Secret handling, scanning, approval prompts, sandboxing | `skills/pr-security-gate/SKILL.md`, `harness/extensions/global/guardrails.ts` |
| Comms | Chat tool, channels, notification habits, drafting rules | `skills/pr-and-team-comms/SKILL.md`, `harness/global/APPEND_SYSTEM.md` |
| Memory | How knowledge survives a session | `vault/`, `skills/wiki-*` |
| Pain log | The last five incidents or recurring frictions | Section 7 (match symptoms) |

### 9.2 Diff against this workflow
For each dimension record one of: absent, partial, equivalent, conflicting. Add evidence (a path in the human's setup, or a command output). Map each gap to a steal-list row. Mode C ends here: deliver the gap table (practice, status, evidence, recommended artifact, rubric score).

### 9.3 Evaluation rubric
Score every candidate artifact on four axes.

| Axis | Scale | Meaning |
|---|---|---|
| Value (V) | 0 to 3 | 3: removes a failure class the human already hit, or one Section 7 records with an incident. 2: saves recurring effort. 1: nice to have. 0: no use here |
| Coupling (C) | 0 to 3 | 0: plain text. 1: generic tools (git, bash). 2: tracker, chat, or browser MCP, or a harness feature that has a fallback in 2.4. 3: a harness-only feature, or the author's environment, with no fallback |
| Risk (R) | 0 to 3 | Harm the artifact can do when it runs or when adapted wrongly. 0: read-only text. 1: local file writes, or it only blocks. 2: writes to shared systems behind a gate. 3: can merge, delete, post, or kill |
| Effort (E) | 1 to 3 | S = 1, M = 2, L = 3 (legend in 0.4) |

Decision rule (starting heuristic [INFERENCE], tune with the human), with Sum = C + R + E:
- Adopt now: V is 2 or more and Sum is 5 or less.
- Adopt in a later layer: V is 2 or more and Sum is 6 to 8.
- Mine the idea only: C is 3 and 2.4 gives no fallback, or the human lacks the environment the artifact assumes.
- Skip: V is 1 or less.
- Safety override: never enable an artifact with R = 3 before the guard and approval layer (steal rows 6 and 7) is installed and its negative controls pass.

Worked examples:
| Artifact | V | C | R | E | Sum | Result |
|---|---|---|---|---|---|---|
| Row 1, honesty and communication prompt | 3 | 0 | 0 | 1 | 1 | Adopt now |
| Row 3, regression placement and mutation check | 3 | 1 | 1 | 2 | 4 | Adopt now |
| Row 5, pre-PR security gate | 3 | 2 | 1 | 2 | 5 | Adopt now |
| Row 6, guard extensions on OMP | 3 | 2 | 1 | 2 | 5 | Adopt now. On another harness C becomes 3: mine the idea and rewrite as hooks |
| Row 11, merge and review loop | 3 | 2 | 3 | 3 | 8 | Later layer, after the guards |
| Row 17, real-dependency verification with SSO | 2 | 3 | 2 | 3 | 8 | Mine the idea unless the human has the same test-user and TOTP setup |
| Row 30, convenience extensions | 1 | 2 | 0 | 1 | 3 | Skip (V is 1 or less) |

### 9.4 Fill the placeholders
Follow 3.5. Resolve with tools, list what is still open, and ask one batched question with options and a recommendation. Record the result where the pack says (constants file, vault project page). Never write a secret value; write the name of the variable or the key.

### 9.5 Install in layers
Restart the harness after each layer and verify in a fresh run (H4). Do not install a later layer on top of a failing earlier one.

| Layer | Artifacts (steal rows) | Pass before the next layer | Why this order |
|---|---|---|---|
| L0 Instructions | 1, 2, 13 | The human reads the constants file and confirms every value | Cheap. Every later layer reads these files |
| L1 Workspace | 4, 24 | A sandbox ticket gets a folder of relative symlinks. A second run with a different slug is refused | A folder per ticket is the base of everything |
| L2 Guards | 6, 7, the ownership guard of 14 | Every negative control in 9.8 step 5 fires | Autonomy is earned by gates, not trust |
| L3 Bug path | 3, 5, 8, plus 10 and 14 as needed | The 9.8 smoke test passes on a sandbox bug | One session, lowest-risk workflow |
| L4 PR, merge, review loop | 10, 11, 12, 15 | A sandbox PR is opened, linked, announced, reviewed, merged, and the item moves one rung | Needs the tracker, chat, and policy setup from L3 |
| L5 Story path | 9 | The contract gate refuses a thin ticket and accepts a complete one | Needs the L3 and L4 machinery |
| L6 Memory and unattended | 16, 18, 19, 26 | A dry run against a sandbox vault with stubbed tools writes only allowlisted paths and is idempotent on rerun | Crons need the vault, the overlay, and the guards |
| L7 Convenience | 20 to 23, 27 to 29 | n/a | Optional |

### 9.6 Translate for the human's harness
1. Replace every `skill://<name>` and `vault://` reference (2.4).
2. Rewrite tool-name keys in deny, prompt, and rule lists from the live tool list (2.2 note).
3. Convert always-on rules into the instruction file. Convert guard extensions into pre-tool hooks. Keep the checks, change the API.
4. Convert commands. Keep the shape: a body under 10 lines that names the skill and passes the argument.
5. Define each subagent type the skills name (`scout`, `reviewer`, `security-reviewer`, `task`, `sonic`) or rewrite the briefs.
6. Map model tiers (E6). Decide what to do about advisors (2.4).

### 9.7 Fix contradictions before the first run
Work through 8.1 in order. For each item: decide, edit the installed copy, search the installed files for the old wording (and plain-word synonyms), and record the decision in the constants file. Do the same for any 8.2 file you need.

### 9.8 Smoke-test one ticket
Use a sandbox: a throwaway repo (or a real low-risk bug), a tracker area for tests, a test Slack channel or a DM, and a sandbox copy of the vault. Run in a fresh session at the tasks root.

1. Load check. Ask the agent to load `workflow-router` and name the commands. Pass: all commands and skills are visible. Otherwise restart.
2. Wiring. Run bootstrap on the sandbox ticket. Pass: one `{TYPE}-{NUM}-{slug}` folder, relative symlinks that resolve, the `.env` link or a normal warning, an excluded repo with no link, the session moved into the folder. Rerun with a different slug. Pass: refused.
3. Reproduce. Pass: `plan/repro.md` with the five headings. Negative control: give a non-bug. Pass: the agent stops and reports evidence instead of guessing a fix.
4. Test first. Pass: the failing output is recorded, then the fix, then a mutation check in the form chosen by `git diff --quiet HEAD -- <files>`, with both outputs recorded.
5. Negative controls (each must fire):
   - read a path in the bare-clone parent: blocked;
   - `kill` a PID this session did not start: blocked, and the agent reports it and stops;
   - ask for a state, title, or description write: the agent asks in chat (behavioral, because the harness fallback is allow);
   - ask for `Closed`: the agent refuses;
   - a comment containing a fake token: the auditor returns UNSAFE or the dialog shows;
   - a diff that contains a seeded fake secret: `scripts/secret-scan.sh` exits 1 and the gate refuses; a clean diff exits 0 (scanner smoke test, P8).
6. PR. Pass: the PR opens only after the gate, uses template A or B, shows the link relation on re-fetch, has the standing reviewers, and is not armed for auto-complete before a required reviewer exists. The PR-open line renders its links in the test channel and appears in channel history.
7. Teardown. Pass: `lsof` shows no leftover port, no browser, no helper process.
8. Merge in the sandbox. Pass: the gate table shows words, not codes. One combined ask. After the merge the item moves one rung with a re-fetch. The vault task closes.
9. Post-merge and the QA check, or record "not applicable" with the reason.
10. Cleanup report. Pass: a dry run lists the folder with a verdict and changes nothing without approval.

Keep `plan/`, `review/`, `docs/`, and the final report as evidence. Report only checks you ran.

### 9.9 Iterate
- Start a papercuts log on day one. Check it first when tooling fails for an unknown reason.
- Classify each friction as rule missing, rule broken, or rule followed but rejected, then change the right layer. "Adding a rule did not remove the friction; changing the rule did."
- Ask why before the fourth edit of the same rule.
- Re-run the 8.5 checks after each batch of edits.

### 9.10 Final report to the human
List: artifacts installed (paths) and artifacts skipped with their rubric scores; placeholders resolved and open; the decision taken on each 8.1 item; files you created for 8.2; unproven items from 8.4 that the human now depends on; residual risks; the restart instruction; the smoke-test evidence. Keep it short and put the decision first.

## 10. Skill index

Neutral name, trigger phrase, stage (Section 5.1 row), and dependencies. Dependencies list other skills, agents, scripts, rules, and key tools. Every project skill is at `skills/<name>/SKILL.md`. Load a skill with your harness's skill loading, one at a time, when its trigger matches.

### 10.1 Workflow skills
| Name | Trigger phrase | Stage | Depends on |
|---|---|---|---|
| `workflow-router` | "Start, resume, or explain a ticket" when the type is unclear | all | Routes to every workflow skill below. `harness/project/AGENTS.md` constants. `move_session` |
| `ticket-triage` | `/triage <id>` | 4 | `ticket-triage-profile`, `grilling`. Subagent type `scout`. Vault read. Tracker MCP through the profile |
| `ticket-triage-profile` | Read only from `ticket-triage` | 4 | Tracker MCP (read, comment write, state write). Rules `azure-cli-fallback`, `ado-area-path`. `harness/project/AGENTS.md`. Hands off to `bug-workflow`, `story-refinement`, `story-workflow` |
| `story-refinement` | Story in `Backlog` or `In Refinement`. `/story <id>` | 5 | `grilling`. `main` reference worktrees (`repo-onboarding` if missing). Rule `azure-cli-fallback`. Tracker MCP. Vault log. Hands off to `story-workflow` |
| `story-workflow` | Story in `Ready for Development`. "Implement story N" | 8 | `ticket-bootstrap`, `service-startup-reference`, `e2e-verification`, `regression-test-placement`, `pr-security-gate`, `pr-creation`, `pr-and-team-comms`, `post-merge`, `tasks-deployed-to-qa`. Agent `flow-runner`. `scripts/self-review.sh`, `scripts/secret-scan.sh`. `services` tool. Playwright MCP |
| `ticket-bootstrap` | "Start work on ticket N", or a ticketless finding | 6 | `scripts/setup-task-branch.sh`, `scripts/setup-task-lsp.sh`, `task-branch-script-internals`, `service-startup-reference`. Rule `azure-cli-fallback`. Tracker MCP. `move_session`. Routes to `bug-workflow`, `story-refinement`, `story-workflow` |
| `bug-workflow` | "Work Bug N". `/bug <id>`. A bug returned after a fix | 7 | `ticket-bootstrap`, `service-startup-reference`, `e2e-verification`, `flow-schema`, `regression-test-placement`, `pr-security-gate`, `pr-creation`, `pr-and-team-comms`, `post-merge`, `tasks-deployed-to-qa`, `deployed-version-check`. Agents `error-detective`, `flow-runner`. `scripts/self-review.sh`, `scripts/secret-scan.sh`. Rules `BUG_FIXING`, `azure-cli-fallback`. `services` and `debug` tools |
| `service-startup-reference` | "Start, verify, or debug a local service" | 9 | `services` tool (`harness/extensions/project/services/`). Agent `error-detective`. `scripts/setup-task-lsp.sh` adapters. Docker, `lsof`. The single PR-build checks table |
| `e2e-verification` | "Prove it against the real dependency" | 10 | `service-startup-reference`. Playwright MCP with `--secrets` and `--isolated`. `automation/playwright/totp.mjs`. The shared test-credential file |
| `flow-schema` | A UI bug needs a Playwright flow | 10 | Agent `flow-runner`. `services` tool. `deployed-version-check`. `e2e-verification` login procedure. Vault notes `flow-schema` and `ui-map` (M2) |
| `regression-test-placement` | "Where does the regression test go?" | 11 | `e2e-verification`, `service-startup-reference`. The calling workflow runs the mutation check. `post-merge` runs catalogue cases after deploy |
| `pr-security-gate` | Before any PR or push of own code | 12 | Agent `pr-security`. `scripts/self-review.sh`, `scripts/secret-scan.sh`, `scripts/gitleaks.toml`, `scripts/gitleaks-report.tmpl`. Tracker MCP for deferred Bugs |
| `pr-creation` | "Open a PR" | 13 | `pr-security-gate`, `pr-and-team-comms`. PR MCP tools. `az` for policies and the required reviewer. Rule `azure-cli-fallback` |
| `pr-and-team-comms` | After a PR opens. Team notification. Replying to threads. Filing a Bug from a finding | 14 | `pr-creation`. Slack MCP with the write tool. Rule `ado-area-path`. Tracker MCP. Vault decisions |
| `pr-comments` | `/comments <pr>` | 15 | `merge-conflict` (PR discovery, task folder), `pr-review` (read-only worktree wiring), `pr-security-gate`, `pr-creation`, `pr-and-team-comms`, `service-startup-reference` (checks). Rules `BUG_FIXING`, `pr-thread-resolution`. `scripts/setup-task-branch.sh --pr`. `ask` tool |
| `merge-conflict` | `/conflict <pr>`. A PR has conflicts | 16 | `scripts/setup-task-branch.sh`. PR MCP tools. PR-build checks in `service-startup-reference` |
| `pr-merge` | "Merge my PR". `/pr-merge [pr]` | 17 | `merge-conflict`, `pr-comments`, `my-pr-status` (scan list), `pr-and-team-comms`, `post-merge`, `tasks-deployed-to-qa`. `automation/board-ingest/prompt.md` (Step 7 table). `az repos pr policy list`. `ask` tool. Slack DM. Vault |
| `post-merge` | After an own PR merges | 18 | Callers `pr-merge`, `morning-brief`. `tasks-deployed-to-qa`. Agent `flow-runner`. Pipelines read and run tools. Vault |
| `tasks-deployed-to-qa` | "Which of my merged tasks are live on QA?" | 19 | `deployed-version-check`. Git clones fetched with explicit refspecs. Tracker MCP. Callers `story-workflow`, `bug-workflow` |
| `deployed-version-check` | "What is deployed to QA?" `/qa-deployed` | 19 | Pipelines MCP. `az rest`. Azure MCP |
| `my-pr-status` | "Status of my PRs". `/pr-status` | 2 | PR and pipelines MCP tools. Slack MCP (variant only) |
| `morning-brief` | "What do I work on today?" `/morning` | 1 | `automation/board-ingest/` (writes the brief and the Step 7 table). `tasks-deployed-to-qa`, `post-merge`. Vault |
| `daily-work-poll` | "What did I do on <day>?" | 3 | Tracker WIQL. Local review folders. Git history (X3) |
| `pr-review` | "Review PR N". `/ado-review <pr>` | 21 | `scripts/setup-task-branch.sh --pr`, `scripts/setup-task-lsp.sh`. Agent `architect-reviewer` plus built-in `security-reviewer` and `reviewer`. Advisor `PRSecurity`. `regression-test-placement`. `skills/pr-review/COMMENT-STYLE-NOTES.md` |
| `task-cleanup` | "Clean up the tasks folder". `/cleanup` | 20 | `scripts/cleanup-task-folders.sh`. PR and work-item reads |
| `task-branch-script-internals` | Editing or debugging `setup-task-branch.sh` | 22 | `scripts/setup-task-branch.sh`, `ticket-bootstrap` |
| `repo-onboarding` | "This repo has no bare clone yet" | 22 | Repo MCP tools. git. Conflicts with the parent-folder guard (X3) |
| `checkmarx-handling` | "Triage this scan report" | 22 | Pipelines MCP. `az pipelines runs artifact download`. Rules `ado-area-path`, `ado-ticket-voice`, `task-files-in-ticket-folder`, `azure-cli-fallback`. Vault note. `ticket-bootstrap` (ticketless folder) |

### 10.2 Vault skills (global)
| Name | Trigger phrase | Stage | Depends on |
|---|---|---|---|
| `wiki-ingest` | "File this source, clipping, or file in `raw/`" | 23 | `vault/schema.md`, `vault/templates/source.md`, `vault://` |
| `wiki-meeting` | "File this transcript or these notes" (including `.vtt`, `.srt`, `.docx`) | 23 | `vault/schema.md`, `people/` pages, `vault://` |
| `wiki-task-loop` | "Work the next task". "Continue the dev loop" | 23 | `wiki-comms` (Slack step). Tracker MCP. Vault. Inside the tasks root the project gates win over its one gate |
| `wiki-sync` | "Sync the vault with the tracker". "Check for drift" | 23 | Tracker MCP. Vault. `morning-brief` mirrors its close step |
| `wiki-query` | "What does the wiki say about ..." | 23 | `vault://`, `vault/index.md` |
| `wiki-lint` | "Lint the wiki". "Find orphan pages" | 23 | `vault://` |
| `wiki-comms` | "Check Slack". "Draft or send a message". A manager update | 23 | Slack MCP. Vault. `wiki-task-loop` |
| `wiki-spec` | "Before changing wiki workflows, schema, or structure" | 23 | `skills/wiki-spec/SPEC.md`, `vault/schema.md` |

### 10.3 Third-party skills
All at `skills/third-party/<name>/SKILL.md`, copied verbatim. Only `grilling` is referenced by a project skill.
| Name | Trigger phrase | Used by | Notes |
|---|---|---|---|
| `grilling` | "Grill me" | `story-refinement` (Step 3), `ticket-triage` (Step 6) | One question per turn, each with a recommended answer. Facts are looked up, decisions are put to the human |
| `grill-me` | Explicit invocation only (`/grill-me`) | none | Thin entry point that runs a `/grilling` session |
| `research` | "Research X" | Named in the `WikiScribe` instructions in `harness/global/WATCHDOG.yml` | Saves findings as a Markdown file |

## 11. Glossary

| Term | Meaning |
|---|---|
| Advisor | A second model that reads the transcript and sends a short note. Roster in `WATCHDOG.yml`. Silence means the work is fine |
| Agent Contract | The six-section block in a story ticket (acceptance criteria, resolved questions, affected repos with non-goals, verification plan, deploy-order notes, stop conditions) that Session B trusts |
| ASD-STE100 | Simplified Technical English, the writing standard for all prose |
| Ancestry check | `git merge-base --is-ancestor <fix> <deployed>`: proof that a deploy contains a fix. Dates are not proof |
| Auditor | A small model role (`tool-call-auditor`) that reviews work-item comments and browser code snippets and answers SAFE or UNSAFE |
| Auto-complete | A tracker feature that completes a PR when every blocking policy passes |
| Bare clone | A git clone without a working tree. Each task branch is a worktree under it |
| Big, Mid, Small tier | Model tiers. Big: open design, triage, final verification (always the main session). Mid: scoped implementation. Small: mechanical work and flow runs |
| Bootstrap | Creating the task folder, worktrees, and tooling for a ticket |
| Catalogue case | A JSON entry in the prompt-regression catalogue that guards assistant behavior |
| Chit-chat thread | A PR thread with no change request (praise, thanks) |
| Contract gate | Session B Step 0: the check that the ticket holds a complete contract |
| Cross-wiring | A service on a fallback port while its callers hit another process on the canonical port. The health check is green and the code is wrong |
| Draft-PR path | Opening a PR with `isDraft: true` when the security gate holds it |
| Fall | A recorded failure with symptom, cause, and fix (Section 7) |
| Flow | A `flow.yaml` step list that a vision model follows in a browser and returns a verdict for |
| Gate | A point where the agent must ask, or must pass a checklist, before acting |
| Guard | An extension that vetoes a tool call by inspecting its final arguments |
| Harness | The agent runtime. OMP is the reference harness here |
| Headless run | A non-interactive agent call (`omp -p`). It has no UI, so a prompt decision blocks |
| Idempotency guard | A log line a job checks so it never files the same day twice |
| Lane | One read-only reviewer's scope in `pr-review` (security, quality, architecture) |
| Main agent | The top-level session. Only it can call `services` and `move_session` |
| MCP | Model Context Protocol: the tool servers for the tracker, cloud, chat, and browser |
| Mutation check | Remove the fix and keep the test: the test must fail. Restore the fix: it must pass |
| OMP | The reference harness, an agent CLI with `.omp/` project folders, extensions, advisors, and `vault://` |
| Papercuts log | A shared file of anything that cost time: date, symptom, fix, project |
| PR-build checks | The commands the PR pipeline runs, kept in one table in `skills/service-startup-reference/SKILL.md` |
| PR-open line | The one fixed Slack line posted when a PR opens. It needs no draft |
| Required and optional reviewer | A required reviewer blocks completion. An API add creates an optional one only |
| Returned bug | A bug whose state went back out of `Resolved`, `Ready for Retest`, or `Closed` after a fix |
| Rule (OMP) | A Markdown file with frontmatter (`alwaysApply`, or `condition` plus `scope`) that injects text. Stream rules misfired and were mostly replaced by hooks |
| `/rev` test | A JSON-Patch test operation on the work item revision: optimistic concurrency |
| Services tool | The custom tool that starts, wires, health-checks, and stops the local services |
| Session A and Session B | The two story sessions: interactive refinement, then autonomous implementation |
| Skill | A `SKILL.md` playbook loaded on demand. Skill-directed means a skill step authorizes the action |
| Slash command | A prompt template that loads a skill and passes `$1` |
| Standing exclusion | A repo the wiring script skips by name (`excluded_repos`) |
| Subagent, worker | A short-lived agent with a narrow brief. It shares no context with the main agent |
| Superseded thread | A PR thread whose other commenters all approved after their own last comment |
| Task folder and tasks root | A per-ticket folder of repo symlinks, and the folder where sessions start |
| Teach-back gate | The triage step where the human explains the ticket and every key point must be covered |
| Tracker | The work-item system (Azure DevOps here) |
| Vault | The personal wiki of typed Markdown pages (Obsidian), with schema, index, and an append-only log |
| Verification gate | The named list of checks that replaces an approval prompt before a PR opens |
| Watch list | The `default` advisor's list of process failures to flag |
| Wave | Execution order of delegated tasks: 1 for no dependencies, else 1 plus the highest dependency wave |
| WIQL | The tracker's work-item query language |
| Worktree | A second working copy of a repo on its own branch, sharing history |
| `[INFERENCE]` | Marks a claim the sources do not prove |

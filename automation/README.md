# Automation

Four small pieces of unattended or semi-attended automation that sit beside the interactive workflow.
All of them were written to live under the project's `<tasks-root>/.omp/` folder, one sub-folder each.
The two cron jobs resolve the tasks root as `$SELF_DIR/../..`, so keep them at
`<tasks-root>/.omp/board-ingest/` and `<tasks-root>/.omp/slack-ingest/` (or change `TASKS_DIR` in `run.sh`).

Common prerequisites for both cron jobs:

- `omp` installed at `~/.bun/bin/omp`.
- A wiki vault at `<VAULT_ROOT>` that follows the vault schema (`schema.md`, `log.md`, `index.md`, `templates/`, `tasks/`, `projects/`, `notes/`).
- `<tasks-root>/.omp/mcp.json` with the Azure DevOps and Slack MCP servers (see `harness/`).
- The run script `cd`s into the tasks root first. This is load-bearing: OMP reads project settings and MCP servers from `<cwd>/.omp` only and does not walk up.
- Placeholders to fill: `<ADO_ORG>`, `<ADO_PROJECT>`, `<ADO_PROJECT_URL_ENCODED>`, `<AREA_PATH_1>`, `<AREA_PATH_2>`, `<YOUR_EMAIL>`, `<TIMEZONE>`, `<team-channel-1..3>`, `<CLIENT>`, `<YYYY-MM-DD>` (`CRON_INSTALLED`). The `INGEST_TZ` env var (default UTC) sets the day boundary in the shell scripts.
- Secrets are never stored in these folders. The scripts read them from the project's gitignored secrets file (the `SECRETS_FILE` variable in `slack-ingest/run.sh`) or from the login-shell environment.

---

## board-ingest

**What it does.** Reads the Azure DevOps board (two configured area paths) and the author's own work items, then writes two vault notes and mirrors live state onto the author's vault task pages.
It never writes to Azure DevOps; it only proposes state moves for a human to apply. Proposals follow a fixed table: Bug `Ready for Fix` -> `Resolved` and Story -> `Ready for Test` once every linked PR has merged; never `Closed`/`Accepted`.

**How it runs.** Cron, weekdays 10:15 by default: `./install.sh` registers `/bin/zsh -lc '<path>/run.sh'` (login shell so the Azure DevOps variables reach the MCP server). `./uninstall.sh` removes only this job's line. `./run.sh [YYYY-MM-DD]` runs by hand or replays a date.
Each run is one `omp -p` call (Sonnet-class model, medium thinking, tools limited to read/write/edit/grep/glob/todo, 25 minute cap) with `overlay.yml` applied, which turns off the advisor and memory and hard-denies every Azure DevOps write tool and `slack_conversations_add_message`.
Idempotent: the prompt stops if `board scan <date>` is already in the vault log.

**Inputs.** Environment: `CLIENT_AZURE_DEVOPS_ORG` (defaults to `<ADO_ORG>`), `CLIENT_AZURE_PAT` (must exist in the login-shell environment; the script refuses to run without it). Vault: previous `notes/board-state.md`, `schema.md`, task pages with an `ado_id`.

**Outputs.** `notes/board-state.md` (state counts and an open-items table, also the baseline for the next run's delta), `notes/morning-brief.md` (ready to close, own open PRs, needs QA deploy check, needs attention, board changes, vault inbox, deferrals), mirrored fields (`ado_state`, `sprint`, `due`, `pr`, drift lines) on existing task pages, one `log.md` entry, and `board.log` for cron output.

**Files copied.** `run.sh`, `install.sh`, `uninstall.sh`, `overlay.yml`, `prompt.md`.

**Skipped.** `board.log` (run log), `sessions/` (every past `omp` session transcript, tool logs and `.lock.os` files; they contain ingested board content).

---

## slack-ingest

**What it does.** Reads the team Slack channels for one calendar day, keeps only durable facts (decisions, status changes, blockers, commitments, identifiers), and files them in the vault: a raw transcript, one source page, link lines on existing project/people pages, inbox task pages for actionable findings, and a log entry.
It never posts to Slack, never writes to Azure DevOps, and never promotes tasks out of `inbox`.

**How it runs.** Cron, daily 08:30 by default via `./install.sh` (the `run.sh` header comment refers to a weekday 11:00 entry as the one actually used; pass any five-field schedule). `./run.sh` with no argument does gap-fill: it builds the set of days already covered from `daily scan YYYY-MM-DD` lines in the vault log, then processes every missing day from `CRON_INSTALLED` through yesterday, oldest first, one `omp -p` call per day, capped at `MAX_BACKFILL_DAYS` (21) per firing. A day whose raw file exists without a log guard line is skipped and reported as needing manual reconciliation. `./run.sh YYYY-MM-DD` covers just that day.
`overlay.yml` denies Slack posting and all Azure DevOps/pipeline writes. The vault skills `wiki-*` are loaded; other skills are not.

**Inputs.** `SLACK_MCP_XOXP_TOKEN`, loaded from the project's secrets file (dotenv-style, must be mode 600; the script checks). The channel list is the `CHANNELS` array in `run.sh`; keep it in agreement with the `slack_channels` field of the client's org page in the vault. Vault: `schema.md`, `templates/source.md`, `templates/task.md`, `log.md`, `index.md`.

**Outputs.** `raw/<date>-slack.md`, `sources/<date>-slack-daily.md`, `tasks/<slug>.md` (status `inbox`, project falls back to `[[team-tasks]]`), appended index and log lines, and `ingest.log` for cron output.

**Files copied.** `run.sh`, `install.sh`, `uninstall.sh`, `overlay.yml`, `prompt.md`.

**Skipped.** `ingest.log`, `sessions/` (past session transcripts and tool logs holding Slack message content), `.lock.os` files. The token file itself was never read or copied.

---

## n8n

**What it does.** Nothing is automated here yet. The folder is an n8n user folder that was initialised for local experiments. Its database held zero workflows when the pack was built.

**How it runs.** Local n8n process pointed at this folder; no schedule.

**Inputs / outputs.** None to document.

**Files copied.** `package.json` (the empty `installed-nodes` manifest n8n creates for community nodes).

**Skipped.** `database.sqlite` (+ `-wal`, `-shm`: credentials store and execution data), `config` (holds the instance encryption key), `n8nEventLog.log`, `crash.journal`, `storage/`. If you build workflows later, export them as JSON with credentials stripped and keep them out of the user folder.

---

## playwright

**What it does.** Helpers for a headless Playwright MCP browser that must log into the web app through single sign-on with a test user.

- `config.json`: Playwright MCP config. Chromium with a Windows/Chrome user agent and matching `sec-ch-ua*` headers, plus an init script.
- `windows-client-hints-init.js`: init script that makes `navigator.platform` and `navigator.userAgentData` agree with those headers, so the page sees one consistent platform. [INFERENCE: this exists to get past an identity provider's device/platform checks when running on macOS; check your own policy before reusing it.]
- `totp.mjs`: RFC 6238 TOTP generator (HMAC-SHA1, 30 s step, 6 digits). Reads `TEST_USER_TOTP_SECRET` from the project's secrets file (two directories above the script), prints one code, waits out the final five seconds of a window so the code does not expire mid-login, never prints the seed. Exit codes 2/3/4 for missing file, missing key, invalid base32.
- `totp.test.mjs`: `node --test` suite using the RFC 6238 Appendix B vectors.

**How it runs.** On demand. Point the Playwright MCP server entry at `config.json` (`--config`) and call `node totp.mjs` when the login form asks for a code. Keep the browser profile directory (`--user-data-dir`) outside git; the global `guardrails.ts` extension blocks reading it and denies the Playwright tools that can read cookies, storage and headers.

**Inputs.** `TEST_USER_TOTP_SECRET` (base32) in the secrets file.

**Outputs.** A 6-digit code on stdout.

**Files copied.** All four files above.

**Skipped.** Nothing in the folder; the real seed, the browser profile, and `mcp.json` live elsewhere and were not read or copied.

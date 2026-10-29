# Handoff pack

One engineer. Many agents. Tickets go in, merged and verified fixes come out.
This folder holds the whole craft: the recipes, the laws, the fences, the scripts, the memory method, and the scars.

## Start here

| You are | Read |
|---|---|
| A human | `FOR-HUMANS.pdf`. Start at "Read Me First". The dictionary is at the end. |
| An AI agent | `FOR-AGENTS.md`. Start at section 1, the steal list. |

## What is in the box

| Folder | What | Install target (OMP harness) |
|---|---|---|
| `skills/` | Workflow recipes, one folder per skill (`SKILL.md`). Triage, bootstrap, bug, story, tests, PR, review, merge, deploy check, cleanup, vault. | `<tasks-root>/.omp/skills/` (project) or `~/.omp/agent/skills/` (wiki-* and ticket-triage) |
| `skills/third-party/` | Upstream generic skills the author used. Copied verbatim. See `CREDITS.md`. | `~/.agents/skills/` |
| `rules/project/`, `rules/global/` | Laws the agent follows. Some always on, some scoped. | `<tasks-root>/.omp/rules/`, `~/.omp/agent/rules/` |
| `commands/` | Slash commands: `/bug`, `/story`, `/triage`, `/morning`, `/pr-status`, `/comments`, `/conflict`, `/pr-merge`, `/ado-review`, `/qa-deployed`, `/cleanup`. | `<tasks-root>/.omp/commands/` (`triage.md`: `~/.omp/agent/commands/`) |
| `agents/` | Subagent definitions: security gate, architecture reviewer, log detective, Playwright flow runner. | `<tasks-root>/.omp/agents/` |
| `harness/global/`, `harness/project/` | System prompt add-ons, rule files, advisor (watchdog) setup, approval policies, config. | `~/.omp/agent/`, `<tasks-root>/.omp/` |
| `harness/extensions/` | Guards and tools in TypeScript: secret guardrails, approval gate, no-parent-folder guard, process-ownership guard, local `services` tool, session tools. | `~/.omp/agent/extensions/`, `<tasks-root>/.omp/extensions/` |
| `harness/mcp.template.json` | MCP servers used (tracker, cloud, browser, chat). Fill the placeholders. | `<tasks-root>/.omp/mcp.json` |
| `scripts/` | Task-folder setup, LSP setup, self-review, secret scan (with gitleaks config), cleanup. | `<tasks-root>/` |
| `automation/` | Scheduled board and chat ingest into the vault, Playwright login helpers. See its README. | `<tasks-root>/.omp/` |
| `vault/` | Personal wiki kit: schema, templates, views, and fictional example pages. | Your Obsidian vault root |
| `build/` | Source of the human PDF (`parts/*.md`) and its build script. | Stays here |

## Fill the blanks

Every org-specific value is a `<PLACEHOLDER>` (for example `<ADO_ORG>`, `<QA_URL>`, `<TECH_LEAD>`).
`FOR-AGENTS.md` section 3 lists each one and where to find its value.
Repo names are roles: `orchestrator` (backend agent API), `web-app` (frontend), `media-mcp`, `data-mcp`, `file-gateway`, `infra` (Terraform), `legacy-agent` (being retired).

## Rebuild the PDF

```bash
cd build && bun build.ts
```

Needs Bun and Chrome, Chromium, or Brave (or set `CHROME_PATH`). The `marked` and `puppeteer-core` packages install on first run.

## License

MIT, see `LICENSE`. Third-party skills in `skills/third-party/` keep their own MIT notices; see `skills/third-party/CREDITS.md`.

FOR HUMANS, READ THE ./FOR-HUMANS.pdf

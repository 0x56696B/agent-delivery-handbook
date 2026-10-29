# Read Me First

## What this book is

**What.** A teaching book. It hands you one engineer's way of shipping software with AI agents.

**Why.** The author is leaving. The way of working lives in files, not in a head. Files can be handed over. Heads cannot.

You are the successor. You may not know the agent harness, the tracker, or the repos. That is fine. This book starts at the fire and walks you to the hunt.

The book teaches one loop. A ticket comes in. An agent does the work. A human holds the gates. A pull request (PR = a proposed code change waiting for review) goes out. The tracker tells the truth. Around the loop sit tools, folders, rules, and a long memory.

> Rock rule: if it matters, it lives in a file.

## How to read the book

**What.** Read it twice. Once fast, once with hands on the keyboard.

**Why.** The first pass gives the shape. The second pass puts the shape in your fingers.

**How.**

1. Read "The Big Idea" in one sitting. It is short.
2. Skim "The Workshop". Set up nothing yet.
3. Read the later parts in order. Each teaches a stage of the loop.
4. Return to "The Workshop" with the pack open. Set up one piece at a time.
5. Use the dictionary at the end. Every strange word is in it.

Every section has the same shape: **What**, **Why**, **How**, **Where in pack** (real paths), sometimes an "Ugh. Fall:" (a true story of pain) and a "Rock rule:" (a one-line law).

Names in this book are roles, never people:

- **The author** built the setup. The author is leaving.
- **Tech lead** reviews code and owns repo standards.
- **QA tester** retests fixes and closes bugs.
- **Product owner** accepts finished stories.
- **The client** owns the platform. **The consultancy** employs the author.
- **The assistant** is the product the platform builds. It is not your coding agent. Your coding agent is "the agent".

The pack has no real names. Client facts are placeholders like `<PROJECT>`, `<ADO_ORG>`, `<QA_URL>`. You fill them from your own world.

## The pack folder map

**What.** One folder, `handoff/`. Everything the author used is inside, cleaned of private facts.

**Why.** You copy parts into your home folder and project folder. Know which part is which.

| Folder or file | What | When you need it |
|---|---|---|
| `README.md` | index of the pack | first look |
| `HANDOFF-FOR-HUMANS.pdf` | this book | now |
| `HANDOFF-FOR-AGENTS.md` | the same craft, written for the agent | when you wire or tune an agent |
| `build/` | `build.ts`, `style.css` that make the PDF | only to rebuild this book |
| `skills/` | recipes, one folder each with `SKILL.md` | every day |
| `skills/third-party/` | upstream skills copied unchanged, `CREDITS.md` | grilling, research, review |
| `rules/global/`, `rules/project/` | laws | day one |
| `commands/` | eleven slash commands | every day |
| `agents/` | four subagent definitions | review, scan, flows |
| `harness/global/`, `harness/project/` | config, prompt files, constants, advisors | day one |
| `harness/extensions/` | guard and tool code | day one, then rarely |
| `harness/mcp.template.json` | template for tool servers | day one |
| `scripts/` | five shell scripts | day one, then daily |
| `automation/` | two morning jobs, login helper, n8n folder | week one and after |
| `vault/` | wiki schema, templates, views, fictional examples | month one |

Four facts about the map:

1. `skills/` holds about three dozen skills. The `wiki-*` ones teach the vault. The rest teach the ticket loop.
2. `skills/workflow-router/SKILL.md` is the index. Lost? Read it.
3. Third-party skills are copied as they were. Do not edit them.
4. The pack has no secrets. No `mcp.json`, no `.env`, no tokens. You make your own.

**Where in pack.** `README.md`, `skills/workflow-router/SKILL.md`, `skills/third-party/CREDITS.md`.

> Rock rule: the pack is a seed, not a cage. Copy it. Then make it yours.

## Reading paths

**What.** Three paths. Pick by time.

**Why.** Reading everything on day one teaches nothing. Learn in layers.

### Day one

Goal: start a session and read the state of the world. Change nothing.

1. Read "The Big Idea" and "The Workshop".
2. Install the harness. Follow "Install order" at the end of "The Workshop".
3. Start a session in the tasks root. Run `/pr-status`. It only reads.
4. Run `/morning`. Read the brief. Approve nothing yet.
5. Read `harness/project/RULES.md` and `harness/project/AGENTS.md` slowly.
6. Read `skills/workflow-router/SKILL.md`. It maps every recipe.

### Week one

Goal: ship one small bug fix with the author's recipes.

1. Read the lifecycle parts of this book in order.
2. Pick one small Bug. Run `/bug <id>`. Watch every gate.
3. Read `skills/bug-workflow/SKILL.md` and `skills/ticket-bootstrap/SKILL.md` while the agent works.
4. Read `rules/global/BUG_FIXING.md`, the bug-diagnosis law.
5. Open the PR. Check it against `skills/pr-creation/SKILL.md`.
6. Read the merge gates in `skills/pr-merge/SKILL.md`. Merge your own PR.
7. Log every pain in `docs/PAPERCUTS.md` in the tasks root. Make the file if missing.

### Month one

Goal: own the system, not only use it.

1. Run a Story through both sessions: Session A refines (`skills/story-refinement/SKILL.md`), Session B builds (`skills/story-workflow/SKILL.md`).
2. Set up the vault. Read `vault/schema.md` and `vault/examples/`.
3. Install the two morning jobs. Read `automation/README.md` first.
4. Audit for drift. Pick one fact. Search every skill for it. You will find a second copy.
5. Change one rule. Test it. Write down why. Then read the wins and falls part of this book.

> Ugh. Fall: the author changed one rule three times in five weeks. The first two versions were guesses.
>
> Rock rule: ask why before you edit a rule a fourth time.

---

# The Big Idea

## One sentence

**What.** Human holds the gates. Agent does the work.

**Why.** The agent is strong and fast. It also forgets, guesses, and says "done" too early. The human is slow and wise. Put each where it is strong.

Agent strong. Agent also forget. You write the recipe. Recipe called skill. Agent reads recipe each time. Recipe is a file, so it does not forget.

The human does not type the code. The human does three things:

1. Gives the ticket number.
2. Answers questions at decision points.
3. Approves what has an audience: a merge, a post in chat, a state that closes a ticket.

Everything else is the agent's job, inside fences.

## The nine words

**What.** Nine ideas. Learn them as nine words.

**Gates.** Some gates are prose ("ask before you comment on a ticket"). Some are a skill step ("draft, then wait"). Some are config: the harness itself stops the call. Three layers. See "The Workshop".

**Ticket folder.** A folder like `BUG-12345-prompt-search-mismatch`. Inside are links to every repo, on the ticket's own branch. Plans, evidence, and review notes live there. Two tickets never share a branch. You run many tickets without branch juggling.

**Skills.** A markdown file with a name and description on top. The prompt carries only name and description. When a job matches, the agent reads the whole file. The prompt stays small. The author built about three dozen, one per stage.

**Rules.** Laws like "never touch the bare repos" and "never write scratch files to `/tmp`". Some sit in the prompt always. Some fire only when text or a tool call matches.

**Guards.** Code that checks the final tool call once, before it runs. Prose gets missed. A guard does not. The author moved every hard law into a guard once prose failed.

**Advisor.** A second model reads the work as it goes. It speaks only on a real problem. Silence means fine. Never ask it to say "looks good". That only makes the main agent re-check everything.

**Subagents.** Short-lived helpers: one writes code in one repo, one reviews security, one runs a browser flow, one correlates logs. They share no memory with the main agent. Write a full brief. Read their real diffs. A helper's "done" is a claim, not proof.

**MCP.** Model Context Protocol, a way to plug tool servers into an agent. The author used four: the tracker (Azure DevOps), the cloud (Azure), chat (Slack), and a browser (Playwright).

**Vault.** A personal wiki, opened as an Obsidian folder. Tasks, decisions, meetings, people, and a log. It outlives any chat.

## How the parts connect

```
                +---------------------+
                |  HUMAN (the author) |   holds the gates
                +----------+----------+
                           | ticket id, answers, approvals
                           v
 +---------------------------------------------------------+
 |  MAIN AGENT   one session, started at the tasks root    |
 |  reads: system prompt, rules (laws), AGENTS.md (facts)  |
 |  loads on demand: skills (recipes), slash commands      |
 +---+---------------+---------------+---------------+-----+
     |               |               |               |
     v               v               v               v
 SUBAGENTS        ADVISOR         GUARDS          TOOLS
 (helpers,      (2nd agent,     (fences on     (MCP: tracker,
  parallel)      watches)       every call)     chat, browser;
     |               |               |          services, git)
     |               |               +-------+------+
     v               v                       v
 +-----------+   +---------+        +----------------+
 | TASK      |   | VAULT   |        | OUTSIDE WORLD  |
 | FOLDER    |   | (long   |        | tracker, chat, |
 | per ticket|   | memory) |        | CI, QA, dev    |
 +-----------+   +---------+        +----------------+
      ^               ^
  scripts wire    two morning jobs
  the folder      fill the vault
```

One human, one main agent. Every tool call passes a guard. Results land in the task folder, the tracker, and the vault.

## The lifecycle in one line

```
triage -> bootstrap -> reproduce -> plan -> test first -> fix -> verify live
   -> security gate -> open PR -> review -> merge -> post-merge -> QA check -> cleanup
```

Bugs run in one session. Stories run in two. Session A makes the ticket a good contract (a written spec the agent trusts). Session B reads only the ticket and builds. Each stage has a skill. Each skill has gates.

## Five laws behind the system

1. **Evidence over claims.** After every tracker write, re-fetch and check. A success message is not proof. A passing mock is not proof. Read the real diff.
2. **The ticket is the contract.** A thin ticket fails the gate in plain view and goes back to refinement.
3. **A check replaces a prompt.** If a question always gets "yes", make it a fact check. The agent opens the PR when the proof list is complete. It does not ask.
4. **The human owns the end.** The agent writes states up to "fixed, not yet verified" and "ready to retest". The tester closes. The product owner accepts.
5. **Guard in code what prose cannot hold.** If a rule broke once, build a fence.

**Where in pack.** `skills/workflow-router/SKILL.md`, `harness/project/AGENTS.md`, `harness/project/RULES.md`, `harness/global/RULES.md`, `harness/project/WATCHDOG.yml`, `harness/global/WATCHDOG.yml`.

> Ugh. Fall: a PR merged unreviewed in about fifteen seconds. The reviewer was only optional, and auto-complete was armed at once. No policy required an approval.
>
> Rock rule: the branch policy is the real gate. Prose only points at it.

---

# The Workshop

This part sets up the fire pit. One section at a time.

One warning first. **Extensions, settings, skills, rules, and commands load when the harness starts.** Create one mid-session and nothing happens. Restart. Test in a fresh session. This cost the author hours.

## The harness and its config

**What.** The harness is the program that runs the agent: it loads prompt, tools, skills, rules, and calls the model. The author used OMP, a terminal coding agent. The shapes fit other harnesses. The file names fit OMP.

**Why.** All the craft hangs on the harness. If it does not load your files, nothing works.

Two levels:

- **Global** at `~/.omp/agent/`: config, prompt additions, global rules, skills, extensions, advisors. The pack copy is `harness/global/`.
- **Project** at `<tasks-root>/.omp/`: config, rules, constants, skills, commands, agents, extensions, MCP servers, advisors. The pack copy is `harness/project/`.

**How.**

1. Install the harness. Check it runs.
2. Make `~/work/<PROJECT>/tasks`. This is the **tasks root**, the only place you start sessions.
3. Make `<tasks-root>/.omp/`. Copy `harness/project/*` into it. Add `skills/`, `rules/project/`, `commands/`, `agents/`, and project extensions in the matching sub-folders.
4. Copy `harness/global/*` into `~/.omp/agent/`. Add `rules/global/` and global extensions.
5. Fill every placeholder. Search for `<` to find them.
6. Restart. Start a fresh session in the tasks root. Ask the agent which skills it sees.

What the configs hold:

- `harness/global/config.yml`: model roles (planning, small jobs, advisors, auditor), advisor settings, display, default approval conditions. It turns off the "unexpected stop detector", which re-prompted finished answers up to three times.
- `harness/project/config.yml`: the project approval list, `git.enabled: false` for the status line, the `vibeExtraTools` list, and the project block of approval conditions.

Use model names you have. The pack keeps only roles: a big model for design, a mid model for scoped work, a small one for mechanical work, a small one for the auditor.

**Where in pack.** `harness/global/config.yml`, `harness/project/config.yml`, `harness/project/dap.json`.

> Ugh. Fall: the author edited an extension and tested it in the same session. Nothing changed. Another extension failed with "Cannot find package": the compiled harness resolves deep package imports only through a build-time map.
>
> Rock rule: restart, then test in a fresh headless run. Import only types from the harness package.

## System prompt files

**What.** Text the harness adds to the system prompt. It sets the agent's manners.

**Why.** Rules say what to do. The prompt says how to talk, how to know, how to stop.

- `harness/global/APPEND_SYSTEM.md`: added to every prompt. Sections: Knowledge limits, Wiki, Writing standard, Communication, Session close, Context clear.
- `harness/global/TITLE_SYSTEM.md`: prompt for the session title: kebab-case, two to five words.
- `harness/global/WATCHDOG.md`: manners for every advisor. Silence means fine. A narrow scope wins.
- `harness/project/AGENTS.md`: standing **facts**: names, repos, who I am, state ladders, vocabulary, folders, environments.
- `harness/global/RULES.md`, `harness/project/RULES.md`: the always-on laws and gates.

What `APPEND_SYSTEM.md` teaches:

- **Say "I do not know".** Check a tool before you state a fact. Never invent a path, flag, number, or URL. Mark only unverified claims inline as `[INFERENCE]`.
- **Answer first.** Ten lines or fewer. Bullets. No tool narration.
- **Translate codes.** Tracker numbers for votes and states become words.
- **Drafts are exact.** Write what was dictated. Add nothing. Show drafts in a fenced block.
- **Plain English.** Simplified Technical English (ASD-STE100): short sentences, active voice, one word per meaning.
- **Close on request.** When the human says "close" or "clear", call the tool. Do not say "type /exit".

`AGENTS.md` is the home of facts. Skills point to it. They never repeat it. About half of sessions match no skill, so facts that live only in skills never load. Keep no people roster there. Roles live in vault `people/` pages.

**How.** Copy the three global prompt files and `AGENTS.md`. Fill placeholders. Tell the harness to read the prompt files as additions.

**Where in pack.** `harness/global/APPEND_SYSTEM.md`, `harness/global/TITLE_SYSTEM.md`, `harness/global/WATCHDOG.md`, `harness/project/AGENTS.md`.

> Ugh. Fall: the agent showed vote numbers and thread ids. The author complained on three separate days before a vocabulary table fixed it.
>
> Rock rule: one table turns tracker codes into words. Keep it in `AGENTS.md`.

## Rules: always-on and scoped

**What.** A rule is a markdown file with a small header. Two kinds.

**Why.** An always-on law costs prompt space each turn. A scoped law costs nothing until its trigger fires.

- **Always-on:** header `alwaysApply: true`. Example: `rules/global/read-tool-first.md` sends reads to the `read`, `grep`, `glob` tools, never `cat` or `ls`.
- **Scoped:** header with a `condition` (regex) and a `scope` (which text or tool to watch). Example: `rules/project/ado-area-path.md` fires when the tracker write tool is called with create or update. The harness injects a reminder mid-stream. OMP calls this TTSR.

Project rules: `no-parent-folder-repo-access` (never touch bare repos or paths above the tasks folder), `tool-gotchas` (a table of tool traps), `azure-cli-fallback` (tracker work goes through MCP; the CLI is for login only), `services-via-services-tool`, `no-orphan-processes-after-use`, `teardown-verification-tooling-after-pr`, `task-files-in-ticket-folder` (scratch never in `/tmp`), `pr-thread-resolution` (never mark another person's thread resolved), `ado-ticket-voice`, `ado-area-path`, `py-runtime-assert`, `py-log-exception`.

Global rules: `read-tool-first`, `no-emoji`, `no-redundant-reverify`, `vault-writes-via-vault-uri`, `BUG_FIXING`, `vibe-extra-tools`.

**How to write a scoped rule that works.**

1. Scope to one tool: `tool:<exact tool name>`. A bare scope matches every tool's arguments.
2. Add regex flags. Without `(?m)`, `^` matches only at offset 0. Without `(?s)`, `.` skips newlines.
3. Test with the harness's rule-test tool against logged calls. A guess is not a test.
4. Remember a rule fires on partial streamed text. For a hard guarantee, use a guard.

**Where in pack.** `rules/global/`, `rules/project/`.

> Ugh. Fall: a path rule interrupted sessions 37 times in four days. It re-tested half-streamed text, so a chunk ending in "tas" matched. Each hit threw away partial output. A guard on final arguments replaced it.
>
> Rock rule: a rule is a tripwire, not a judge. Hard laws go in a guard.

## Guards and extensions

**What.** An extension is a TypeScript file the harness loads at start. It adds tools (`services`, `move_session`) or hooks every tool call (a guard).

**Why.** A guard checks the final call once, before it runs.

| File under `harness/extensions/` | Does |
|---|---|
| `global/guardrails.ts` | blocks reads of keys, secrets files, browser profiles; masks secrets as `*****`; asks before `env` |
| `global/tool-approval-gate.ts` | applies approval conditions to three tools; fails closed |
| `project/no-parent-folder-guard.ts` | blocks any path that leaves the tasks folder |
| `project/process-ownership-guard.ts` | blocks stopping a process this session did not start |
| `project/services/index.ts` | the `services` tool: start, stop, check local services; keeps a ledger |
| `global/move-session.ts` | the `move_session` tool |
| `global/end-session.ts`, `clear-context.ts`, `compact-context.ts` | close, clear, compact when you ask in plain words |
| `global/advisor-gate.ts`, `advisor-drain.ts` | wake dormant advisors; hold the turn open until advisors finish |
| `global/mode-presets.ts`, `title.ts`, `vibe-extra-tools.ts` | model and mode presets; session names; extra tools for the vibe-mode director |

Limits:

- `guardrails` is "a guardrail, not a sandbox". Command substitution, `bash -c`, and variable indirection bypass it.
- `no-parent-folder-guard` is lexical. It does not resolve symlinks, because task-folder links resolve into the bare repos and that route is mandated.
- A block reason that starts with `process-ownership-guard:` is final. Report it. Stop a foreign process yourself with `omp ps stop <name>` in your own terminal.
- The `services` tool refuses bare-repo paths and non-symlink paths.

**How.** Copy global extensions to `~/.omp/agent/extensions/`, project ones to `<tasks-root>/.omp/extensions/`, with `lib/`. Start fresh. Try a call the guard should block. If a guard blocks a good call, fix the call, not the guard.

**Where in pack.** `harness/extensions/global/`, `harness/extensions/project/`, `harness/extensions/project/services/plan.test.ts`.

> Ugh. Fall: a service-helper agent killed a process another task owned. Later it tried `kill $(lsof -ti :PORT)`. "Never stop a foreign process" in prose had failed. A ledger guard fixed it.
>
> Rock rule: whoever starts a process owns it. Nobody else stops it.

## Approval gates: ask-before and auto

**What.** Two lists. What the agent must ask. What it does alone.

**Why.** Too many prompts and you click "yes" unread. Too few and the agent does harm. The author cut every always-yes prompt.

Three layers enforce the lists:

1. **Prose rule** in `RULES.md`: "Ask before you comment on a work item."
2. **Skill step** in `SKILL.md`: "Draft, then wait" or "Open the PR now".
3. **Harness config**: `deny` on a tool, or a prompt with an auditor review.

A skill step that says "open the PR", "post the notice", or "move the state" is itself the approval. Do it. Then re-fetch. A step that says "draft, then wait" keeps its gate.

**Ask first:**

- Any Slack post except the one-line PR-open notice. Draft in a fenced block. Wait for "send it".
- A tracker comment, when the skill says "show the draft".
- A tracker state, title, or description write outside the auto list.
- A PR vote. A merge. Arming auto-complete outside the merge skill.
- A push after review or conflict fixes.
- Deleting task folders.
- Starting a service by hand, not through the `services` tool.

**Auto:**

- All reads.
- Area path, iteration path, assign to self.
- Skill-directed moves: `New` to `Ready for Triage`; `Ready for Triage` to `Ready for Fix` after the bug reproduces; `Resolved` or `Ready for Test` once every linked PR has merged; `Ready for Retest` or `In Test` once the QA deploy check proves the fix is live.
- Open a PR when the proof list passes. Post the PR-open line.
- Make folders and worktrees through the scripts.

**Never by the agent:** `Closed`, `Pending PO Review`, `Accepted`; votes; merges outside `pr-merge`; QA login.

How the config does it:

- `tools.approval` in `harness/project/config.yml` holds `deny` or `prompt`. It denies the browser tools that read network and console data, tracker branch creation (branches come from the script), and the backlog tool.
- `toolApprovalConditions` governs three tools: tracker work-item writes, tracker comments, and Playwright `run_code_unsafe`. Global defaults sit in `harness/global/config.yml`. The project block deep-merges over them: objects merge, scalars override, the `rules` list replaces whole.
- Work-item writes have fallback `allow`. The harness does **not** prompt for a state, title, or description write. The agent must ask in chat. Only the `/rev` test, area path, iteration path, and assign-to-self with your own identity pass by rule.
- Comments and browser snippets use fallback `prompt` plus an **auditor**: a small model reads the text. SAFE runs with no dialog. Anything else shows the text and the auditor's note. Rubrics: `harness/global/tool-call-auditor.md`, `harness/project/tool-call-auditor.md`. A project may add rules but not relax a global one.
- **Fail closed.** If a config file cannot be read, the three governed tools are blocked.

**How.** Copy both `config.yml` files and both auditor files. Replace `<YOUR_EMAIL_ESCAPED>` and `<YOUR_DISPLAY_NAME>` in the self-assign rule. Test one call per governed tool: see the prompt, the allow, the block. Review prose and config in one pass, or they will disagree.

**Where in pack.** `harness/project/RULES.md`, `harness/project/config.yml`, `harness/global/config.yml`, `harness/extensions/global/tool-approval-gate.ts`.

> Ugh. Fall: prose said "ask before modifying a work item", but nothing prompted. Config had no entry. Prose and config disagreed.
>
> Rock rule: name the enforcer of each gate. No named enforcer, no gate.

## MCP servers and the template

**What.** Four tool servers set in `mcp.json`. The pack gives a template, not the file.

**Why.** They are the agent's hands. Without them it cannot read a ticket, post a PR, or click a page.

- `azure-devops`: tickets, PRs, pipelines, wiki, repos. Logs in with a scope-limited personal access token.
- `azure-mcp`: cloud resource reads. Uses your cloud CLI login.
- `playwright`: a browser. Runs with `--secrets`. It types credentials by key name, so the value never reaches the model.
- `slack`: read and post chat, with a user token. Set the add-message flag only if you want posting.

**How.**

1. Copy `harness/mcp.template.json` to `<tasks-root>/.omp/mcp.json`.
2. Replace each `<PLACEHOLDER>`. The file holds the **name** of an environment variable, not the secret.
3. Export the variables in your shell **before** you start the harness. A later export stays invisible. Relaunch. Do not just reload MCP.
4. The tracker variable holds base64 of `:` plus the token, not the raw token.
5. Keep the Playwright secrets file outside git. Agents never read or print it.
6. Pin the Playwright MCP version (the template says `@latest`; replace it). Run it isolated, one per session. Four processes on one profile caused "Browser is already in use".
7. Always pass `project` to tracker calls. Without it: "Client does not support form elicitation".

The cloud CLI is for login only, after an MCP failure. Then retry the MCP call once. One exception: no MCP tool exposes the action at all, such as deleting a posted PR comment.

**Where in pack.** `harness/mcp.template.json`, `rules/project/azure-cli-fallback.md`, `rules/project/tool-gotchas.md`, `automation/playwright/`.

> Ugh. Fall: the tracker said "success" on a comment that came back with empty backticks. It had stripped angle-bracket tags.
>
> Rock rule: re-fetch after every write. A reply reports the call, not the state.

## The task-folder model

**What.** One folder per ticket. Inside, one link per repo, each pointing at the ticket's own branch copy.

**Why.** Many tickets in parallel. No branch switching. No cross-talk. Scratch files stay in one place.

```
~/work/<PROJECT>/
  <repo>-bare/              one bare clone per repo (sessions never touch it)
    .env                    one env file per repo (never read, printed, copied)
    main/                   reference copy of main
    fix/<slug>/             one worktree per task branch
  tasks/                    THE SESSION ROOT. Start every session here.
    .omp/                   the project harness
    setup-task-branch.sh    and the other four scripts
    docs/PAPERCUTS.md       global log of anything that cost time
    main/                   repo links, each synced with main
    archive/                notes of removed task folders
    BUG-12345-<slug>/       one folder per ticket
    STORY-12346-<slug>/
    PR-REVIEW-4567-<slug>/
    RESEARCH-00000-<slug>/
```

Words:

- **Bare clone** (`<repo>-bare`): a git copy with history and no checked-out files. The store.
- **Worktree**: a second working copy on its own branch, same history. Cheap.
- **Tasks root**: the one start folder. The harness reads `<cwd>/.omp` only. Start elsewhere and MCP servers, rules, and skills vanish.
- **Repo symlink**: a link in the task folder, named after the repo, pointing at that ticket's worktree. `read` follows it. `git -C <folder>/<repo>` works through it.
- **The `main` folder**: a folder in the tasks root with a repo link per worktree, each synced with `main`. The agent reads current main there, never from the bare repos. If it is missing, the agent tells you and asks you to create it with the setup script.

Inside a task folder:

- `<repo>` links: one per in-scope repo. Leave them all.
- `plan/`: design docs (`repro.md`, `FIX-PLAN.md`, `STORY-PLAN.md`, `VERIFICATION.md`) and commit-message files.
- `docs/`: evidence: `attachments/`, `flow.yaml`, `flow-runs/`, `HANDOFF.md`.
- `review/`: `SECURITY-GATE.md`, `REVIEW.md`, lane reports, scan reports.

Scratch stays in the ticket folder. Never `/tmp`.

**The `.env` file.** It lives once at the bare-repo root. The script **symlinks** it into each worktree. One edit changes every worktree of that repo. Some old notes say "copies". They are wrong.

- Never read, print, copy, or commit `.env` values. The guard masks them as `*****`. Never write the stars to a file. Ask the human for a secret.
- Send sibling URLs through process env at start (the `services` tool `env` argument). Never edit `.env` for that.
- `.env.local` is the agent's. Its first line is exactly `# managed-by: omp-agent (non-secret overrides only)`. No secrets. Check it is gitignored.
- Review mode (`--pr`) makes no `.env` link.

**Start at the root, then move.** A session starts in the tasks root. For a ticket, the agent calls `move_session` into the ticket folder. It can move only to the launch folder or a direct child. The ticket folder links the shared `.omp`, so MCP stays attached. A subagent cannot move. It uses absolute paths.

1. `glob` for `*-<NUM>-*` in the tasks root.
2. Folder exists: `move_session` into it before any work, even a status check.
3. No folder: stay at the root. Bootstrap makes it and moves.
4. A Story gets **no folder** before Session B passes its contract gate.

**Never remove what the script made.** After `setup-task-branch.sh`, never remove a repo symlink, branch, or worktree it made. Keep every repo linked, even out-of-scope ones, because later testing may need them. Only the retiring legacy repo is skipped, by the script. Only `/cleanup` removes a finished task, after you approve.

**Where in pack.** `scripts/setup-task-branch.sh`, `scripts/setup-task-lsp.sh`, `scripts/cleanup-task-folders.sh`, `skills/ticket-bootstrap/SKILL.md`, `skills/task-branch-script-internals/SKILL.md`, `skills/repo-onboarding/SKILL.md`, `skills/task-cleanup/SKILL.md`, `rules/project/no-parent-folder-repo-access.md`, `rules/project/task-files-in-ticket-folder.md`, `harness/extensions/global/move-session.ts`.

> Ugh. Fall: an agent tidied up. It deleted branches, worktrees, and symlinks of out-of-scope repos. The author needed them to test and rebuilt them by hand.
>
> Rock rule: never remove what the script made.

> Ugh. Fall: a subagent wrote `../plan/...` from inside a repo symlink. The shell resolved the link first. The folder landed outside the tasks folder.
>
> Rock rule: subagents get absolute paths. Never `../` from a repo link.

> Ugh. Fall: `grep` said "No matches found" for text that existed. The path was the symlink itself. `grep` fails on a link and works on a real directory below it.
>
> Rock rule: search a whole repo with `git -C <folder>/<repo> grep`. Full table: `rules/project/tool-gotchas.md`.

## Naming of folders and branches

**What.** A strict pattern.

**Why.** Tools find folders with a glob on the ticket number. Free-form names break the lookup.

Folder: `{TYPE}-{NUM}-{very-brief-dash-summary}`. Type uppercase. Summary is a short dash-cased paraphrase of the title. The script makes the folder. Never `mkdir` it first.

| Work | Folder | Branch |
|---|---|---|
| Bug | `BUG-12345-prompt-search-mismatch` | `fix/<slug>` |
| Returned bug, round n | same folder | `fix/<slug>-<N>-r<n>` |
| Story | `STORY-12346-memory-prompt-guard` | `feat/<slug>` |
| Research, no ticket | `RESEARCH-00000-<slug>` | `research/<slug>` |
| Test sandbox | `SANDBOX-00000-<slug>` | default branch |
| PR review | `PR-REVIEW-4567-<slug>` | the PR's source branch |
| PR, no work item | `PR-4567-<slug>` | the PR's source branch |

Roads:

- One folder per ticket. The script refuses a second folder with the same `{TYPE}-{NUM}-` and a new slug. Reuse the name it reports.
- Stories use `STORY-`, not `US-`. Old notes say `US-`. They are stale.
- A vault-driven non-ticket task uses branch `task/<slug>`.
- One commit per repo per ticket. Amend, do not stack.
- Bare clones have no fetch refspec. A plain `git fetch origin` updates only `FETCH_HEAD`. Use `+refs/heads/<b>:refs/remotes/origin/<b>`.
- Fix a PR conflict by merging, never rebasing. `--force-with-lease` only on your own amended branch. Never `--force`.

**Where in pack.** `skills/ticket-bootstrap/SKILL.md`, `skills/pr-creation/SKILL.md`, `skills/merge-conflict/SKILL.md`, `harness/project/AGENTS.md`.

## Setup scripts

**What.** Five shell scripts that do the boring work the same way each time.

**Why.** Hand-made worktrees and links drift. A script is idempotent: run twice, same result.

- `scripts/setup-task-branch.sh <branch> <target_dir>`: make or reuse the branch worktree in every bare repo, link `.env`, link each worktree into the new task folder. Exit 0, or 1 naming failed repos.
- `scripts/setup-task-branch.sh --pr <repo> [--target-branch <b>] <branch> <folder>`: review mode. One repo, branch fetched from origin, no `.env` link.
- `scripts/setup-task-lsp.sh <task_dir>`: link `.omp`, install each repo's dependencies, install pinned language-server tooling, write `lsp.json`, `dap.json`, `pyrightconfig.json`.
- `scripts/self-review.sh <repo-path> [base]`: write the diff to `review/self-<repo>.diff`. Flag new code comments, env files, dependency changes, secrets. Exit 0 clean, 1 findings, 2 usage.
- `scripts/secret-scan.sh <repo-path> [base]`: gitleaks over commits, staged, unstaged, untracked. Values redacted. Same exit codes.
- `scripts/cleanup-task-folders.sh`: `report`, `clean`, `clean-worktree`, `strays`, `prune`. Dry run unless `--apply`.

Facts:

- Run `setup-task-branch.sh` from the tasks root. It finds every `*-bare` folder in the **parent** of the folder you run it from. A relative `target_dir` resolves against your cwd.
- Script broken? Read `skills/task-branch-script-internals/SKILL.md`. Repo has no bare clone? Read `skills/repo-onboarding/SKILL.md`.
- `secret-scan.sh` needs the `gitleaks` tool. It also expects `gitleaks.toml` and `gitleaks-report.tmpl` in the tasks root. Copy both from `scripts/`. Smoke-test the config: one case that must fire, one that must pass. Use a rule-scoped allowlist. A global one is silently ignored when default rules are extended.
- The shell tool caps a command at 300 seconds. Clean in batches of three or four folders. Pass `timeout` explicitly.

**Where in pack.** `scripts/`, `skills/pr-security-gate/SKILL.md`, `skills/task-cleanup/SKILL.md`.

> Ugh. Fall: scripts passed on the author's machine and crashed only under cron or in tests.
>
> Rock rule: test scripts in a sandbox, in the real shell, with a rerun.

## Install order

1. Install the harness and tools: `git`, `pnpm`, `uv`, `gitleaks`, a cloud CLI, `lsof`.
2. Make `~/work/<PROJECT>/tasks`.
3. Bare-clone each repo as `<repo>-bare` with a `main` worktree (`skills/repo-onboarding/SKILL.md`).
4. Copy harness files, rules, skills, commands, agents, extensions, scripts.
5. Make `mcp.json` from the template. Export variables. Relaunch.
6. Make the `main` folder. Make `docs/PAPERCUTS.md`.
7. Fill every placeholder. Restart. Start fresh in the tasks root.
8. Test: run `/pr-status`. Try a blocked call. Run the branch script in a sandbox.

> Rock rule: finish one piece, test it, then the next.

---

# The Daily Loop

## How a day flows

**What.** A day has a shape: morning read, pick, work, review, close.

**Why.** Shape saves thinking. The agent does the reading before you wake.

```
 before      start        pick          work            review        end
 jobs run -> brief  --> a ticket --> bug or story --> comments,  --> poll, log,
             + PR card               (own session)     merge         cleanup
```

The author worked in an 11-hour band. Two unattended jobs ran before it began.

Entry points in the order you meet them: `/morning`, `/pr-status`, then `/bug`, `/story`, or `/triage` for a ticket, `/comments` and `/conflict` for review work, `/pr-merge` for your own PR, `post-merge` after it, `/qa-deployed` to learn if a fix is live, `daily-work-poll` to recall a day, `/cleanup` each week.

About 15 percent of the author's human turns were saved-command calls. Each command is a prompt under ten lines. It names a skill and passes one argument. It never restates steps, so it cannot drift from the skill.

**Where in pack.** `commands/`, `skills/workflow-router/SKILL.md`.

## The morning brief

**What.** A list of tickets whose PRs merged and wait for a state move, plus items that need you.

**Why.** Manual status checks were the most frequent recurring prompt. A job reads. You approve once.

**How the brief is made.** A cron job (`board-ingest`) runs on weekday mornings. It makes one headless agent call that can read the tracker but **cannot write to it**: a config overlay denies every tracker write tool and the chat post tool. The job:

1. Stops if the log already holds `board scan <date>`. Idempotent.
2. Queries the team board and your own open items.
3. Counts open threads on your active PRs.
4. Proposes one move per item by a fixed table: Bug `Ready for Fix` with all PRs merged to `Resolved`; Story before test with all PRs merged to `Ready for Test`. Never `Closed` or `Accepted`.
5. Overwrites two vault notes (board state, morning brief). Appends one log entry.

**How you work it.** Type `/morning`.

1. The agent reads the brief. If its date is not today, it says so and re-derives "ready to close" live. Never act on a stale list.
2. It shows each row: ticket, title, state to proposed state, merged PR.
3. You give **one** approval for the list. A subset is fine.
4. For each approved row it writes the state with a `/rev` check, then re-fetches.
5. It marks matching vault tasks done and logs.
6. For "Needs QA deploy check" rows it runs `tasks-deployed-to-qa`. On proof it writes `Ready for Retest` (Bug) or `In Test` (Story) with no prompt.

**Where in pack.** `skills/morning-brief/SKILL.md`, `commands/morning.md`, `automation/board-ingest/prompt.md`, `automation/board-ingest/run.sh`, `automation/README.md`.

> Ugh. Fall: "who touched this?" answers were wrong. A "changed by me" query returns only the last editor.
>
> Rock rule: attribute work through revision fields (changed by, resolved by, closed by), never by date.

## My PR status

**What.** One fixed card of your open PRs.

**Why.** One fixed card scans in seconds. A live fetch avoids stale votes.

Type `/pr-status`. Output is one fenced block. The agent:

1. Lists your active PRs, one call per repo, in parallel.
2. Reads merge status, reviewers, linked ticket, threads.
3. Classes each build: `no run`, `running`, `failed`, `stale` (green, but `main` moved or a newer push has no run), `passed`.
4. Prints per PR: number, short title, ticket, votes (names, no numbers), comments, checks, one state line.

State order: merge conflict, pipeline failed, rejected, waiting for author, open comments, pipeline needs re-run, needs an approval, ready to merge.

Read-only. It never votes, comments, or posts. A Slack list of PRs needing approval is made only on request: draft in chat, post after "send it".

**Where in pack.** `skills/my-pr-status/SKILL.md`, `commands/pr-status.md`.

> Ugh. Fall: a PR with a green build could not auto-complete. `main` had moved, so the policy build expired. A fresh plain run did not attach to the policy.
>
> Rock rule: re-queue through the policy action, not a new run.

## The daily work poll

**What.** A report of what you did on a day. Ask "What did I do on <day>?".

**Why.** The tracker alone misses PR reviews saved as local files and commits on feature branches.

Three sources, merged:

1. **Tracker.** Items changed in the range with you as changer. The tracker stores UTC. Pin the range twice: UTC for the tracker, local for file times.
2. **Local review folders.** `PR-*` and `PR-REVIEW-*`. File times in `review/` prove the day. `REVIEW.md` holds the verdict.
3. **Git history.** Every branch, matched to ticket numbers so one piece counts once. Read through task-folder links, never the bare repos.

Report per item: number, title, type (Bug, Story, PR review, commit-only), short description. Say plainly when a source returned nothing. A recap happens only when asked: one line each, no codes.

**Where in pack.** `skills/daily-work-poll/SKILL.md`.

## The wiki task loop

**What.** A generic dev loop driven by vault task pages. It works a task on a `task/<slug>` branch with one approval.

**Why.** Some work has no ticket. A vault task page is the ticket. The loop gives it the same shape.

1. Pick a task: one you name, or the top-priority page with `status: todo`.
2. Set `status: doing`. Make sure a tracker item exists, or make one.
3. Resolve the repo from the project page. Branch `task/<slug>` before any edit.
4. Implement. Test end to end with the repo's own commands.
5. Commit and push. Write a decision page per design choice.
6. **Gate.** Show the diff. One approval covers the PR, the tracker review move, and `status: review`.
7. Open the PR. Move the item. Draft a short chat update. Wait for approval.
8. Append a log entry.

On a blocker: add a `## Blocker` section to the task page, keep `status: doing`, report, log.

Inside the tasks root, the project rules win over this generic gate. The PR opens with no prompt after verification. Tracker moves follow the exception list in `harness/project/RULES.md`.

Sibling vault skills (run one only when you ask): `wiki-ingest`, `wiki-meeting`, `wiki-sync`, `wiki-query`, `wiki-lint`, `wiki-comms`, `wiki-spec`.

**Where in pack.** `skills/wiki-task-loop/SKILL.md`, `skills/wiki-sync/SKILL.md`, `vault/schema.md`.

## Session hygiene

**What.** Habits that keep a session clean and cheap.

**Why.** In five weeks, 70 of 300 of the author's sessions ended aborted (23 percent), and 87 of 280 were harness or tooling work (31 percent). A messy session wastes context and loses state.

**One session per ticket.**

1. One ticket, one session. Do not mix.
2. Start at the tasks root. Always.
3. For a ticket, the agent moves into its folder with `move_session`. Even for a status check.
4. Run setup scripts with the shell `cwd` at the tasks root.
5. A subagent cannot move. Give it absolute paths.
6. Start a Story's Session B fresh. It trusts only the ticket.

**Where state lives.** A session can die. Put state in files: plans and evidence in the ticket folder, decisions and task status in the vault, ticket state in the tracker. The author logged 110 `/clear` in five weeks, and one recap showed ticket state lost after a clear. A per-ticket resume file (`plan/STATE.md`) was proposed. It is a proposal, not shipped.

**Close, clear, compact.** Say it in plain words.

- "Close the session": the agent calls `end_session` with a short reason, writes one line, stops.
- "Clear the context": it calls `clear_context`, confirms in one line.
- "Compact": it calls `compact_context`.

No confirmation. No "type /exit". Never while your requested work is unfinished. Never to escape a hard task. After a clear or compact the session may return to the launch folder, so move into the ticket folder again. [INFERENCE: the return to the launch root was designed; a live run is not recorded in the sources.] State a durable fact one turn **before** you close. The exit gate runs before the scribe advisor reviews.

**Other habits.**

1. After you touch a tool or extension, restart. Test fresh.
2. Stop every process you start before you yield. Run `lsof` after. Report the result.
3. Check the port before you start a service. If another process owns it, never stop it. Pick another port, or ask the owner.
4. Close the browser and stop verification services before the PR link and notice.
5. A clean advisor or reviewer verdict is final. Do not re-run checks for comfort.
6. When a tool costs you time, append one line to `docs/PAPERCUTS.md`: date, symptom, fix, project. Read it first when a tool fails for no known reason.
7. Never start a session inside a repo worktree. It loses MCP, rules, skills, and commands.

**Where in pack.** `harness/global/APPEND_SYSTEM.md`, `harness/extensions/global/end-session.ts`, `harness/extensions/global/clear-context.ts`, `harness/extensions/global/compact-context.ts`, `harness/extensions/global/move-session.ts`, `rules/project/no-orphan-processes-after-use.md`, `rules/global/no-redundant-reverify.md`.

> Ugh. Fall: a browser and dev servers kept running after the PR. Orphan helpers piled up.
>
> Rock rule: leave nothing running that was not running before.

> Ugh. Fall: a helper's "done, tests pass" was forwarded as truth. The tests had not run.
>
> Rock rule: a helper's report is a claim. Read the real diff and output.

## A day, step by step

**What.** One sample day. Use it as a checklist.

**How.**

1. Open a session in the tasks root. Run `/morning`, then `/pr-status`.
2. Fix what waits on you: `/comments <pr>`, `/conflict <pr>`.
3. Pick a ticket: `/bug <id>`, `/story <id>`, or `/triage <id>` for a thin one.
4. Watch each gate. Approve drafts. Read evidence.
5. PR approved: `/pr-merge <pr>`. Then `post-merge`. Later, ask "is it on QA?".
6. End of day: ask `wiki-comms` to draft the manager update if you owe one. Close the session.

> Rock rule: the agent reads and drafts. You decide what has an audience.

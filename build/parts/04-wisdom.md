# The Long Memory: Your Vault

Chat forgets. Files remember. The vault is a pile of small notes. The agent reads them before it speaks. The agent writes them after it learns. Like the story wall in the cave: paint a fact once, and every later hunt can see it.

## Why a personal wiki

**What.** The vault is a folder of typed notes: Markdown files, each with a header block of fields. You open the folder in Obsidian (a note app that treats a folder of text files as a book). The agent reads and writes the same files.

**Why.** Chat is a campfire: warm, then ash. A chat dies at `/clear` or a restart, and its facts die too. The vault keeps them. It is also the truth for task state: the tracker mirrors the vault, never the reverse. It records rejected options, so nobody argues them twice.

**How.** Three layers, one law each.

| Layer | Folder | Law |
|---|---|---|
| Raw sources | `raw/` | Originals. The agent reads them. Nobody edits them. |
| The wiki | typed folders | The agent owns it. It keeps links, index, and log fresh. |
| The schema | `schema.md`, `wiki-*` skills | The contract: types, fields, names, log format. |

```
 clip, transcript, chat --> raw/ (frozen)
                              | ingest
                              v
 you, scribe, cron jobs --> typed pages tied by [[wikilinks]]
                              |-- schema.md says how
                              |-- index.md lists them
                              `-- log.md records each write (append only)
```

**Where in pack.** `vault/schema.md`, `vault/index.md`, `vault/log.md`, `vault/examples/` (fictional practice pages), `skills/wiki-spec/SPEC.md`.

## The eight page types

**What.** Eight types, one folder each.

| Type | Folder | Holds | Key fields |
|---|---|---|---|
| org | `orgs/` | a client, the employer, "Personal" | `ado_org`, `slack_channels` |
| project | `projects/` | one repo or product | `repo_path`, `ado_states` |
| task | `tasks/` | one unit of work | `status`, `priority`, `ado_id`, `pr` |
| meeting | `meetings/` | one meeting | `date`, `kind`, `attendees` |
| person | `people/` | one person | `org`, `role`, `slack_id` |
| decision | `decisions/` | one choice, with reasons | `date`, `status`, `supersedes` |
| note | `notes/` | reusable facts, filed answers, lint reports | `projects`, `topics` |
| source | `sources/` | one ingested thing | `origin`, `url`, `raw` |

**Why.** Each folder is a table, each file a row, each header field a column. Obsidian Bases (`.base` files: saved tables over those fields) then give you a task board and a decision log for free.

**How.**

1. Names are kebab-case. Meetings, decisions, sources, and dated notes start `YYYY-MM-DD-`. People are `first-last.md`.
2. Links are wikilinks: `[[people/jane-doe]]`. In a header field, wrap the link in quotes.
3. A task `status` is inbox, todo, doing, review, done, or dropped.
4. A decision page has Decision, Context, Reasoning, Consequences. The deep form adds Mechanism, Files changed, Evidence, Known gaps, Alternatives rejected. Turn each known gap into a task or an owner. Gaps warn you of drift.
5. A replaced decision stays. Mark it `superseded`.

**Where in pack.** `vault/templates/`, `vault/views/` (six `.base` files), `vault/examples/decisions/` (a supersede chain).

## The schema is the contract

**What.** One file, `vault/schema.md`, says what every page must look like.

**Why.** Many sessions write pages. Without a contract, pages wander. With one, lint can check them by machine.

**How.** It holds the tree, naming rules, a field table per type, the log format, and five hard laws:

1. `raw/` is immutable.
2. `log.md` is append-only.
3. Ask before a PR, before a tracker move to review or done, and before any Slack post. In the tasks root, project rules refine this: a skill step that says "open the PR" is the permission.
4. The vault is task truth. Tracker state never silently overwrites it.
5. All vault prose follows ASD-STE100 (plain English: short active sentences, one word per meaning).

Change in this order: schema, templates, views, skills.

**Where in pack.** `vault/schema.md`, `skills/wiki-spec/SKILL.md` (read it first), `skills/wiki-spec/SPEC.md` (nine locked decisions, gates, setup).

> Rock rule: change the schema first.

## How agents reach the vault

**What.** Agents use `vault://` addresses, never file paths.

**Why.** The route gives the edit tool a snapshot tag. A raw path has no tag. A rule stops the shortcut and sends the agent to read the schema first.

**How.**

1. Find: `read vault://wiki/?op=search&q=<keywords>`.
2. Read, write, edit: `vault://wiki/<folder>/<page>.md`.
3. An edit header reads `[vault://wiki/<path>#TAG]`. Copy the tag from a read of the same page. A shortened path fails.
4. Ask structure with `?op=outline`, `?op=backlinks`, `?op=links`, `?op=tags`, `?op=tasks`. Ask vault-wide with `?op=orphans`, `?op=unresolved`.
5. Never `grep` the wiki folder. Read the schema before any write.
6. Write in three cases only: you name a wiki skill, you ask for a write, or you name a page. A statement of fact is not a write request.
7. The main agent writes directly. It hands off only a big, multi-page write.

**Where in pack.** `rules/global/vault-writes-via-vault-uri.md`, `harness/global/RULES.md`, `harness/global/APPEND_SYSTEM.md` (section `# Wiki`).

> Rock rule: address by `vault://`, never by path.

## Ingest: put a source on the wall

**What.** `wiki-ingest` files one new source: a clipping, document, link, or pasted text.

**Why.** Raw stays pure. A summary and links make it findable.

**How.**

1. Pasted text goes to `raw/YYYY-MM-DD-<slug>.md`. Never edit a raw file.
2. Read it all. Make `sources/YYYY-MM-DD-<slug>.md` from the template: origin, raw link, projects, summary.
3. Add one line and a wikilink on each related project, org, or person page.
4. Add the index line. Log op `ingest`.

**Where in pack.** `skills/wiki-ingest/SKILL.md`, `vault/templates/source.md`, `vault/examples/sources/`.

## Meeting notes

**What.** `wiki-meeting` turns a transcript into a meeting page, people pages, and tasks.

**Why.** Meetings hide decisions and chores. A page makes them searchable.

**How.**

1. Clean first: a caption file (`.vtt`, `.srt`) loses cue numbers, timestamps, and repeats. No speaker labels? Ask for attendees.
2. Save it in `raw/`. Pull out date, kind, project, org, attendees. Unsure? Ask. Never guess a project or org link.
3. Match attendees to `people/first-last.md`. Transcripts misspell names, so a close match needs your yes. A bracket tag in a Teams export means guest or host, not employer.
4. Name who raised each point. Each action item: same issue open in `tasks/`? Add a Notes bullet there. Else make a task with `status: inbox`, `priority: p3`.
5. Link the meeting from the project page. Log op `meeting`.

**Where in pack.** `skills/wiki-meeting/SKILL.md`, `vault/examples/meetings/2026-03-04-platform-standup.md`.

## Sync with the tracker

**What.** `wiki-sync` keeps vault tasks and tracker items in step. The vault wins.

**Why.** Two truths rot. One boss keeps order. Drift gets flagged, never silently fixed.

**How.**

1. Load the project's `ado_states` map (vault status to tracker state). Missing? Read the real state names and write them down.
2. Push the vault to the tracker. A push to review or done waits for your yes. Never change vault `status` from the comparison. Copy `sprint` and `due` from the tracker.
3. Close `review` tasks whose PR merged, after you approve.
4. Pull new assigned items as `inbox` pages. Never promote without your answer.
5. Flag drift in a `## Drift` section. Leave header fields alone. Log op `sync`.

**Where in pack.** `skills/wiki-sync/SKILL.md`, `vault/examples/projects/meter-api.md` (see `ado_states`).

## The task loop

**What.** `wiki-task-loop` works one vault task from `todo` to `review`.

**Why.** Some work has no ticket. A task page is the ticket. The loop gives it the same shape.

**How.**

1. Pick the named task, or the top `todo` (p1 first, oldest first). Set `status: doing`.
2. Make sure a tracker item exists. Find the repo path on the project page (ask once, save it).
3. Branch `task/<slug>`. Build and test with the repo's own commands. File a decision page for each design or scope choice.
4. Gate: show the diff. In the plain loop one approval covers the PR, the tracker review move, and `status: review`. Log op `task`.
5. Stuck? Add a `## Blocker` section, stay `doing`, report.

Correction for the ticket pipeline: inside the tasks root, project rules win. The PR opens with no prompt once the verification gate passes. Tracker moves follow the exception list in `harness/project/RULES.md`.

**Where in pack.** `skills/wiki-task-loop/SKILL.md`, `harness/project/RULES.md`.

## Lint, log, query, comms

**What.** Four habits keep the wall clean.

**Why.** An unchecked wiki rots in silence.

**How.**

1. Lint weekly with `wiki-lint`: orphan pages, unresolved links, schema drift, stale `doing` tasks (older than five working days), contradictions (two decisions, one scope, neither superseded), pages missing from the index. It writes `notes/YYYY-MM-DD-lint-report.md`.
2. Log every write: `## [YYYY-MM-DD] <op> | <title>`, then one to three bullets. Ops: ingest, meeting, task, sync, lint, query, comms, setup. Read the last lines first, then append. Never insert at an old line number. Never edit a past entry.
3. `wiki-query`: read `index.md` first, search, read candidates in full. Answer only from pages, with a wikilink per claim. File a durable answer as a note.
4. `wiki-comms`: read Slack, resolve people to pages, draft, wait for approval, send the approved text unedited. A manager update is two sentences and has no send step.

**Where in pack.** `skills/wiki-lint/SKILL.md`, `skills/wiki-query/SKILL.md`, `skills/wiki-comms/SKILL.md`, `vault/log.md`, `vault/examples/notes/2026-03-13-lint-report.md`.

## Who writes back: you, the scribe, two cron jobs

**What.** Three writers help you keep the wall painted.

**Why.** Facts used to vanish between sessions. Narrow writers fix that. A tight allowlist keeps them off task state, the schema, and every outside system.

**How.**

1. The scribe is the `WikiScribe` advisor. Once per finished run it files only facts the transcript already shows. It never goes hunting. It writes `notes/`, `decisions/`, an append to `log.md`, and the Links and Notes bullets of an existing project page. Never `raw/`, task state, `schema.md`, `index.md`, the tracker, PRs, or Slack. It extends a page that exists. It never makes a twin.
2. A config change counts as a decision, even two lines (a roster, a rule, a gate, a state order, a model pin). A finished research task counts too.
3. The reminder to write back: after a write, the scribe sends one note at nit severity, one line per page. Nothing to file means silence. The `advisor-drain` extension holds the turn open until the scribe finishes. After fall V2 the author raised the "did it file the fact?" check to blocker severity, because a concern-level card was silent and a missing write-back went unseen for days. `harness/global/WATCHDOG.yml` does not show that setting. Add it if you want the check that loud.
4. State a fact one turn before you close the session. The exit gate runs before the scribe reviews. The `end_session` tool drains advisors first. A typed `/exit` does not.
5. Two cron jobs fill the vault before you wake. `board-ingest` writes the board state and the morning brief. `slack-ingest` files one day of team chat. Both run headless, with an overlay that denies tracker and Slack writes, and a guard line in `log.md` that makes a rerun safe.

**Where in pack.** `harness/global/WATCHDOG.yml`, `harness/global/WATCHDOG.md`, `harness/extensions/global/advisor-drain.ts`, `automation/README.md`, `skills/morning-brief/SKILL.md`.

## Set it up in six steps

**What.** Build your own vault in one afternoon.

**Why.** An empty vault with a schema beats a full vault with none.

**How.**

1. Copy `vault/schema.md`, `vault/index.md`, `vault/log.md`, `vault/templates/`, and `vault/views/` into your own folder (the pack uses `<VAULT_ROOT>`). Keep the fictional `vault/examples/` outside it. The example `vault/examples/notes/service-registry.md` shows a port column. Your real registry holds no ports (fall D18).
2. Open the folder in Obsidian as a vault, so `vault://wiki/` resolves. Keep `vault: enabled: true` in `harness/global/config.yml`.
3. Copy the `skills/wiki-*` folders into your global skills folder. Add the `# Wiki` section of `harness/global/APPEND_SYSTEM.md` to your prompt additions. Copy the vault rule, the vault laws in `harness/global/RULES.md`, the `WikiScribe` entry of `harness/global/WATCHDOG.yml`, and the two advisor extensions.
4. Check it. Read `vault://wiki/schema.md` (the route works). Read `skill://wiki-ingest` (skills load). Read one item from each MCP server.
5. Make org pages (you, your employer, your client, Personal) and a project page per repo, on demand. Run `wiki-sync` once to seed tasks from the board.
6. Run `wiki-lint` weekly. Restart after any skill or extension change.

**Where in pack.** `skills/wiki-spec/SPEC.md` (section Setup), `vault/`, `harness/global/`.

# Glory: What Worked

Thirty things worked. Each is a stone that held. Copy them. The tags W1 to W30 are stable, so you can point at them.

## Start clean

**What.** Four habits that start every ticket the same way. **Why.** A messy start taxes every later step.

**W1. One command per entry point.** Eleven slash commands (short prompts starting with `/`), each under ten lines. Each names a skill and passes the argument. *Why it works:* no retyped openers (15% of human turns were saved commands). It cannot drift, because it never repeats steps. *Where:* `commands/`, `skills/workflow-router/SKILL.md`.

**W2. One folder per ticket, one script.** Folder `{TYPE}-{NUM}-{summary}` holds repo symlinks. Only `scripts/setup-task-branch.sh` makes it. It is safe to rerun, refuses a second folder for one ticket, skips standing exclusions, and has a `--pr` mode. *Why it works:* parallel tickets, no branch juggling, no hand-made worktrees. *Where:* `scripts/setup-task-branch.sh`, `skills/ticket-bootstrap/SKILL.md`.

**W3. Start at the root, move on purpose.** Sessions start at the tasks root. A `move_session` tool moves into a task folder, or back. *Why it works:* MCP servers, rules, and skills load from the launch folder only. A fixed rule (root or direct child, never from a subagent) ends per-move prompts. The return to root after `/clear` is designed, not yet seen live. *Where:* `harness/extensions/global/move-session.ts`.

**W4. One file of standing facts.** `harness/project/AGENTS.md` holds org and project names, repo scope, state ladders, a vocabulary table for tracker codes, environments, folder habits. *Why it works:* about half of sessions match no skill, so a fact that lives only in a skill never loads. One copy ended repeated corrections and let 11 to 13 skills shrink.

> Rock rule: same start, every ticket.

## Prove the fix

**What.** Six habits that turn "I think it works" into evidence. **Why.** Agent says "done" fast. Proof says "done" slow. Slow is cheaper than a returned bug.

**W5. Reproduction is the contract.** Bootstrap, reproduce, root cause with `file:line`, fix plan per repo, failing test first, smallest fix, mutation check, live verify, one commit per repo, scripted self-review, then open the PR without asking. *Why it works:* each step leaves evidence a reviewer can re-run. Gates earn autonomy. The mutation check (remove the fix: the test must fail; restore it: it must pass) proves the test guards the fix. *Where:* `skills/bug-workflow/SKILL.md`, `scripts/self-review.sh`, `rules/global/BUG_FIXING.md`.

**W6. A table: where does the test go?** A lookup from "what broke" to "where the test lives": function, API field, assistant behaviour, produced file, screen, journey. *Why it works:* "add a regression test" stops being a judgement call. *Where:* `skills/regression-test-placement/SKILL.md`.

**W8. Design per repo, cross-check, walk the deploy order.** A short design doc per repo with `file:line` proof, a second pass that checks both sides fit, then every ship order walked with what a user sees. *Why it works:* a design can be right once both sides ship and broken in between. Stale citations hide in good-faith documents. *Where:* `rules/global/BUG_FIXING.md` (multi-repo fixes; trust but verify).

**W9. Live verification against the real dependency.** A pass through real services, storage, and model gateway is part of "done". *Why it works:* a mock holds your guess. For varying answers, run a baseline on `main` against the fix branch: many runs, memory reset per run, control prompts, and a stop if the baseline shows no bug. *Where:* `skills/e2e-verification/SKILL.md`.

**W10. Flow file plus flow-runner.** One `flow.yaml` per UI bug, run three times (broken on the pre-fix build, fixed on the fix branch, fixed on QA) by a cheap vision model. *Why it works:* a flow that never says "broken" on the broken build proves nothing, so the dispatcher proves the served build first. *Where:* `skills/flow-schema/SKILL.md`, `agents/flow-runner.md`.

**W30. Scripts tested in a sandbox, in the real shell.** Prove scripts on synthetic bare repos under macOS `/bin/bash` 3.2, with fail-closed and rerun cases. *Why it works:* some bugs show only under cron's shell or on a second run. *Where:* `scripts/`.

> Rock rule: no proof, no done.

## Tickets and plans as contracts

**What.** Four habits that treat the ticket as the spec. **Why.** A thin ticket makes a fast wrong answer.

**W7. Two sessions for a story.** Session A (refinement, or `/triage`) grills the human and writes an Agent Contract. Session B starts blank, trusts only the ticket, checks the contract, builds, opens the PR. *Why it works:* it tests the ticket as a handoff. A thin contract fails the gate: a comment names the gaps, the state returns to refinement, the original text stays. *Where:* `skills/story-refinement/SKILL.md`, `skills/story-workflow/SKILL.md`, `skills/ticket-triage/SKILL.md`.

**W24. Plans as files with numbered decisions.** Seven headings: Context, Decisions, Verified facts, Approach, Critical anchors, Verification, Assumptions. *Why it works:* a fresh session can build and verify without the chat. The implementer makes no design choices. *Where:* no template ships. Copy the headings into your plan notes.

**W29. Say what "actionable" means.** Four rules decide when a board bug has work left. "Picked up" means a folder, branch, PR, or live session, never mere assignment. *Why it works:* the brief stops guessing. *Where:* `skills/morning-brief/SKILL.md`.

**W13. Facts decide state moves.** The agent writes `Resolved` or `Ready for Test` once every linked PR merges, and `Ready for Retest` or `In Test` once a QA deploy is proven. It never writes `Closed`, `Pending PO Review`, or `Accepted`. *Why it works:* each move follows a checkable fact, has one legal next value, and can be undone. One rung per write, then re-fetch. *Where:* `harness/project/RULES.md`, `skills/pr-merge/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md`.

> Rock rule: the ticket is the contract. Facts move the state.

## Fences that hold

**What.** Six fences, mostly in code, not prose. **Why.** Prose gets missed under autonomy. Code does not blink.

**W11. Approval gates in config.** Prompt and deny policies on write tools, plus one global gate that fails closed, with project overrides. An optional auditor model lets only a clear SAFE verdict skip the dialog. *Why it works:* a fail-closed list survives missing config. *Where:* `harness/extensions/global/tool-approval-gate.ts`, `harness/global/tool-call-auditor.md`, `harness/project/config.yml`.

**W12. Guard extensions in code.** Hooks block: stopping a process this session did not start, touching anything outside the tasks folder, starting a service from a bare repo, leaking secrets. *Why it works:* a `tool_call` hook checks the final arguments once, before the tool runs. *Where:* `harness/extensions/global/guardrails.ts`, `harness/extensions/project/no-parent-folder-guard.ts`, `harness/extensions/project/process-ownership-guard.ts`.

**W15. Security gate before every PR.** A fail-closed secret scan before any push, plus a `pr-security` subagent review of your own diff. Introduced finding: fix now. Pre-existing: file a Bug, go on. At most two fix rounds. Too big: draft PR. *Why it works:* explicit rules end the loop. *Where:* `skills/pr-security-gate/SKILL.md`, `agents/pr-security.md`, `scripts/secret-scan.sh`.

**W27. Secrets by key name.** The Playwright MCP types real credentials when the agent passes a key name, and redacts the value. TOTP codes come from a tiny CLI. The secrets file is hard-blocked for reads. *Why it works:* secret values never enter the model's context. *Where:* `skills/e2e-verification/SKILL.md`, `automation/playwright/totp.mjs`.

**W28. One owner per port.** Whatever starts a service owns its port, checks conflicts, and reports the real port. Docs point at the owner. *Why it works:* a copied port is wrong once a default changes. *Where:* `skills/service-startup-reference/SKILL.md`, `harness/extensions/project/services/index.ts`.

**W25. Safe cleanup tooling.** A script that reports first, defaults to dry run, refuses dirty repos, removes the worktree's Docker leftovers, and acts only on items the human names. *Why it works:* cleanup destroys, so a report plus a named list stops bulk deletes. *Where:* `scripts/cleanup-task-folders.sh`, `skills/task-cleanup/SKILL.md`.

> Rock rule: if it must hold, put it in code.

## Review and merge

**What.** Three habits for the last mile. **Why.** A merge is hard to undo.

**W14. PR hygiene as a checklist.** Conventional-commit title, two description templates under 200 words, an evidence section, a verified work-item link, a required reviewer before auto-complete, a table of forbidden wording. *Why it works:* the description carries only what a reviewer cannot infer: no "Fixes N", no suite-pass count. *Where:* `skills/pr-creation/SKILL.md`, `skills/pr-and-team-comms/SKILL.md`.

**W16. Review lanes, with claim-checking.** Read-only security, quality, and architecture subagents. The main agent checks each claim against code before repeating it. *Why it works:* lanes over-claim. The human reads one verified two-part report and posts drafts one at a time. *Where:* `skills/pr-review/SKILL.md`, `agents/architect-reviewer.md`, `agents/error-detective.md`.

**W17. Merge gates.** `pr-merge` checks pipeline freshness, paired-PR order, and branch policies, sorts open threads, asks once, and never merges an unpicked PR. *Why it works:* one combined ask keeps friction low. Only a thread's author resolves it. A vote on a colleague's PR is not merge authority. *Where:* `skills/pr-merge/SKILL.md`, `skills/pr-comments/SKILL.md`, `rules/project/pr-thread-resolution.md`.

> Rock rule: ask once, with facts on the table.

## Honest, short, plain

**What.** Four habits about how the agent talks and works. **Why.** The author reads many replies a day. Clear beats clever.

**W20. Honesty rules in the system prompt.** "Say I do not know." Check a tool before stating a fact. Mark only unverified claims as `[INFERENCE]`. Ask one direct question on real ambiguity. *Why it works:* the author never objected to "I did not test X". *Where:* `harness/global/APPEND_SYSTEM.md`.

**W21. Chat rules derived from evidence.** Answer first. Ten lines or fewer. Tracker codes become words. Coined labels get defined. Drafts match the dictation. *Why it works:* the rules came from 28 classified confusion cases. Confusion came from identifiers and undefined labels, not length. *Where:* `harness/global/APPEND_SYSTEM.md`, `harness/project/AGENTS.md`.

**W22. The read-tool-first rule.** An always-on rule (advisors get it too) sends known-path reads to `read`, with a tested table of tool traps for symlinked repos. *Why it works:* agents fall back on `ls` and `cat` at session start. An A/B run showed 2 shell `ls` calls before and 0 after. *Where:* `rules/global/read-tool-first.md`, `rules/project/tool-gotchas.md`.

**W23. Delegation discipline.** Self-contained worker briefs. One worker per repo, absolute paths. The orchestrator holds every gated write and re-reads every real diff. *Why it works:* a worker's "done" is a claim. Port cross-wiring makes parallel live runs unsafe, so live checks run one at a time. *Where:* `rules/global/BUG_FIXING.md`, `skills/story-workflow/SKILL.md`.

> Rock rule: say what you know. Say what you did not check.

## Memory and automation

**What.** Three habits that work while you sleep. **Why.** Memory outside the chat survives the chat.

**W18. Unattended crons, two barriers.** `board-ingest` and `slack-ingest` run `omp -p` with an overlay that denies tracker and chat write tools, plus a prompt allowlist. *Why it works:* the unattended path cannot write even if the prompt is wrong. Guard lines make reruns safe, and missing days backfill oldest first. *Where:* `automation/board-ingest/`, `automation/slack-ingest/`.

**W19. The vault as durable memory.** Schema, index, append-only log, immutable `raw/`, and decision pages with "Known gaps". *Why it works:* knowledge survives `/clear` and restarts, and rejected options are not re-argued. *Where:* `vault/`, `skills/wiki-spec/SPEC.md`.

**W26. Papercuts log plus rule timeline.** One line per time sink (date, symptom, fix, project), plus an analysis that sorts each failure: rule missing, rule broken, or rule followed but rejected. *Why it works:* it shows which layer to change. Adding a rule did not remove the friction. Changing the rule did. *Where:* `harness/project/AGENTS.md` (the order to keep it).

> Rock rule: write it where the next session can read it.

# The Fall: What Hurt

Sixty falls. The author fell so you can walk. Each story gives what happened, why, the fix, and the law it made. The tags (A1, H2, and so on) are stable, so you can point at them. "Pack" names the file that holds the fix. "None" means the lesson lives in habit, not in a file.

## Agent behaviour (A1 to A7)

Agent clever. Agent also wanders. Seven stories.

> **A1. Ask, not look.** Agent said "want me to check?" about a thing a tool could answer. No rule said fetch first. Fix: look in code, config, docs, tracker; ask only when tools cannot. *Rock rule: fetch, then speak.* Pack: `harness/global/APPEND_SYSTEM.md`.

> **A2. Mock, not real.** Checks ran against a stubbed API. The author demanded the real app. A live-check rule existed, but nothing gated it. Fix: a live pass is part of done; an advisor flags reports with no evidence. *Rock rule: no live pass, not done.* Pack: `rules/global/BUG_FIXING.md`.

> **A3. "Done, tests pass."** A worker said done; the orchestrator forwarded it. A report is a claim, and workers share no context. Fix: read the real diff and test output first. *Rock rule: a report is a claim.* Pack: `rules/global/BUG_FIXING.md`.

> **A4. Guess and hide.** "Strengthen the rule" was settled by guessing, then announcing the guess. Another agent rebuilt an artefact the author had rejected. The agent picked a reading and moved on. Fix: two readings, one direct question; drop a thread once decided. *Rock rule: two readings, one question.* Pack: `harness/global/APPEND_SYSTEM.md` (first fix only).

> **A5. Notes the human never saw.** A reply began by correcting an advisor note the author never saw, and reviewer jargon arrived raw. No rule covered unseen sidecar output. Fix: never mention what the human did not see; translate subagent results into plain words. *Rock rule: show only what the human saw.* Pack: `harness/global/APPEND_SYSTEM.md`.

> **A6. Re-checking a clean verdict.** A clean advisor verdict set off another round of re-testing. Approval felt like a nudge. Fix: a clean verdict is final; re-verify only for a new concern or changed code. *Rock rule: clean means stop.* Pack: `rules/global/no-redundant-reverify.md`.

> **A7. Plan mode forgot the laws.** In plan mode the agent proposed touching a secret despite a ban. House rules reach plan mode only by hook. Fix: a plan-only hook injects two rules: no secret in a plan; every state-changing step names its verify and undo. *Rock rule: plans obey the laws.* Pack: not shipped. Rebuild it from these two rules.

## Harness and tooling (H1 to H11)

The harness is a strange beast. Eleven bites.

> **H1. Five tripwire gates.** Five stream-rule gates (write, PR, Slack, comment, implement-first) stalled autonomous runs. Stream rules abort output on a match. Fix: remove all five; use prose, config prompts, and an advisor; put hard laws in hooks. *Rock rule: a tripwire is not a judge.* Pack: `harness/project/WATCHDOG.yml`.

> **H2. The path guard that cried wolf.** A path rule interrupted sessions 37 times in four days. It re-tested half-streamed text, so a chunk ending "tas" matched. Fix: a `tool_call` hook on final arguments. *Rock rule: judge the final call.* Pack: `harness/extensions/project/no-parent-folder-guard.ts`.

> **H3. Rules that never fired, or fired wrong.** A length rule almost never fired; ticket rules fired on a `grep`. `^` needs `(?m)`, `.` needs `(?s)`, and a bare scope hits every tool. Fix: scope `tool:<exact name>`, add flags, test on logged calls. *Rock rule: test rules on real logs.* Pack: `rules/project/ado-area-path.md`.

> **H4. Changes with no effect.** An extension, setting, or skill made mid-session stayed invisible; one extension died on "Cannot find package". Everything loads at start. Fix: restart, test in a fresh `omp -p` run, import only types. *Rock rule: restart, then test fresh.* Pack: `harness/extensions/global/lib/advisor-config-compat.ts`.

> **H5. Denied, with no reason.** A browser code tool was blocked with no prompt, and a headless worker could not approve it. After another denial with no recorded reason, an agent tried a browser sign-in and a PAT `curl` instead. Two layers denied it, and no deny gave a reason. Fix: one prompt owner, a reason on every deny, and when denied, ask or stop. *Rock rule: denied means ask, never route around.* Pack: `harness/extensions/global/tool-approval-gate.ts`.

> **H6. Answers said three times.** Final answers repeated up to three times after a hidden "attempt N/3" nudge: the stop detector took a finished answer for a stall. Fix: turn it off. *Rock rule: a nagging helper needs an off switch.* Pack: `harness/global/config.yml`.

> **H7. Prose said ask, config said allow.** "Ask before modifying a work item" prompted nothing: the gate fell back to `allow`. Fix: write down who enforces what; ask in chat before a state, title, or description write. *Rock rule: prose and config are one document.* Pack: `harness/project/RULES.md`.

> **H8. The 300-second wall.** A batch cleanup died at the shell cap of 300 s after 7 of 14 folders; four relaunches hit it again. `async` does not lift the cap. Fix: batches of three or four, an explicit `timeout`. *Rock rule: know the cap, size the batch.* Pack: `skills/task-cleanup/SKILL.md`.

> **H9. Fine in my shell, dead in cron.** Scripts crashed only in cron: "unbound variable". macOS `/bin/bash` 3.2 treats an empty array as unbound under `set -u`. Fix: guard empty arrays, test under `/bin/bash`. *Rock rule: test in the shell that will run it.* Pack: `scripts/secret-scan.sh`.

> **H10. One browser profile, four processes.** Playwright failed with "Browser is already in use", then `@latest` moved the Chromium revision. Four MCP processes shared one profile lock, and the version was unpinned. Fix: `--isolated` per session, pin the version. *Rock rule: pin it, isolate it.* Pack: `harness/mcp.template.json` (still `@latest`: pin yours), `agents/flow-runner.md`.

> **H11. Search blind to symlinks.** `grep` said "No matches found" for text that exists. `read` follows task-folder symlinks, `glob` works from the link down, `grep` fails on the link itself. Fix: a per-tool table, `git -C <repo> grep`, an always-on `read` rule. *Rock rule: test each tool on a symlink.* Pack: `rules/project/tool-gotchas.md`, `rules/global/read-tool-first.md`.

## Git and worktrees (G1 to G5)

Git is honest. Git is also picky. Five stories.

> **G1. Phantom remotes.** `--force-with-lease` failed with "stale info", and `git push -u` exited 128 though it worked. Bare-clone worktrees have no fetch refspec. Fix: explicit refspecs; confirm a push with `git ls-remote`. *Rock rule: ask the remote, not the exit code.* Pack: `scripts/self-review.sh`.

> **G2. Stash during a merge.** After `git stash` mid-conflict, `stash pop` dropped `MERGE_HEAD`. Stash and an open merge fight. Fix: never stash or rebase during a merge; merge the target into the branch; never force-push a shared branch. *Rock rule: merge, never stash, never rebase.* Pack: `skills/merge-conflict/SKILL.md`.

> **G3. The tidy-up that deleted rigs.** An agent deleted the branches, worktrees, and symlinks of out-of-scope repos, and the author needed them for testing. The script had no exclusion idea. Fix: an `excluded_repos` array; after setup remove nothing. *Rock rule: after setup, remove nothing.* Pack: `scripts/setup-task-branch.sh`, `harness/project/RULES.md`.

> **G4. Reviewing yesterday's code.** A PR review in a reused worktree showed the old tip. Reuse checked out the cached branch, not the fresh fetch. Fix: in PR mode force the local ref to the fetched head and compare with the PR head. *Rock rule: prove the head before you review.* Pack: `scripts/setup-task-branch.sh` (`--pr`).

> **G5. The `..` that escaped.** A subagent wrote `../plan/...` from a repo symlink and made a folder outside the tasks folder. The shell resolved the link before the `..`. Fix: absolute task-folder paths for subagents. *Rock rule: absolute paths for helpers.* Pack: `harness/extensions/project/no-parent-folder-guard.ts`.

## Local services (S1 to S7)

Services are noisy neighbours. Seven stories.

> **S1. Green and wrong.** Health was green, but the stack served another branch's code, so the first flow run was void. Hard-coded localhost ports cross-wire stacks. Fix: prove the served build (`lsof` the PID's cwd, `curl` one source module); run live checks one ticket at a time. *Rock rule: health is not identity.* Pack: `skills/service-startup-reference/SKILL.md`.

> **S2. Ready, but not ready.** `hub start` timed out on a dev server that was serving pages: it binds the IPv6 loopback, and the probe checked IPv4. Fix: readiness by log regex; `curl` `localhost` as proof. *Rock rule: ready means the log says so.* Pack: `harness/extensions/project/services/index.ts`.

> **S3. Debugger could not attach.** The readiness probe's connect-and-close used up debugpy's single client slot, and `--reload` forks a child the debugger cannot see. Fix: no ready gate in debug mode, a passive `lsof` check, no `--reload`. *Rock rule: never poke the debug port.* Pack: `harness/project/dap.json`.

> **S4. The kill that hit a neighbour.** A service agent killed a process another task owned. "Never stop a foreign process" was prose only. Fix: an ownership ledger; block `pkill`, `killall`, `xargs kill`, and any `kill` without a literal PID. *Rock rule: whoever starts it owns it.* Pack: `harness/extensions/project/process-ownership-guard.ts`.

> **S5. Services that did not talk.** An unprefixed sibling-URL override is accepted and ignored; the database container was down. Fix: exact prefixed names on the command line; read the startup log's printed URL. *Rock rule: the printed URL is the proof.* Pack: `harness/extensions/project/services/index.ts`.

> **S6. Dead key, silent probes.** Every image call returned 401; a PAT check returned 302 for real and bogus tokens. A probe with no control cannot tell good from bad. Fix: every probe carries a control; escalate dead keys to the owner. *Rock rule: a probe needs a control.* Pack: none (papercuts log).

> **S7. The orphans.** A Playwright browser and dev servers kept running after the PR. Nothing tore them down. Fix: close tabs, stop only what this session started, run an orphan check. *Rock rule: clean up what you started.* Pack: `rules/project/no-orphan-processes-after-use.md`.

## Tracker (T1 to T6)

The tracker is a polite liar. Six stories.

> **T1. "Success" that lied.** A write "succeeded" but angle-bracket tags became empty backticks, and an API-added reviewer was optional. A response reports the call, not the state. Fix: re-fetch and check the field after every write. *Rock rule: the response is not the state.* Pack: `harness/project/RULES.md`.

> **T2. Unattended reads that asked a person.** Cron reads failed with "Client does not support form elicitation": with no `project`, the tool asks, and nobody is there. Fix: always pass `project`. *Rock rule: name the project, every call.* Pack: `rules/project/tool-gotchas.md`.

> **T3. State jumps that bounce.** A state write got HTTP 400 though the matrix allows all-to-all. Jumps fail in practice. Fix: one neighbouring state per write, the ladder from `get_type`, then re-fetch. *Rock rule: one rung at a time.* Pack: `skills/ticket-bootstrap/SKILL.md`.

> **T4. The returned bug treated as new.** A bug the tester moved back was handled as new; bootstrap would have overwritten `Bug Test Failed`. No branch existed for returned tickets. Fix: a Step 0 for returned bugs: read history and comments, reproduce on current code, say why the first fix failed, skip the state write. *Rock rule: a returned bug keeps its state.* Pack: `skills/bug-workflow/SKILL.md`.

> **T5. Who touched this?** "Changed by me" returns only the last editor, and the board is an area path, not an iteration path. Fix: attribute through revision fields (changed, resolved, closed by); query the area path. *Rock rule: ask the field that holds the truth.* Pack: `skills/morning-brief/SKILL.md`.

> **T6. The zero-byte report.** An artefact download "succeeded" with a 0-byte zip. The MCP download is broken for this report type. Fix: CLI fallback into the task folder, never the tasks root. *Rock rule: check the file size, not the success message.* Pack: `skills/checkmarx-handling/SKILL.md`.

## PR and review (P1 to P8)

The PR is where trust meets code. Eight stories.

> **P1. Merged in fifteen seconds.** A PR auto-merged unreviewed in about 15 seconds; `main` was reverted by hand. The API adds only optional reviewers, and auto-complete was set right after. Fix: make the reviewer required (CLI), re-fetch, then arm auto-complete. *Rock rule: policy is the gate; prose only points at it.* Pack: `skills/pr-creation/SKILL.md`.

> **P2. A vote that merged.** An `Approved` vote on a colleague's PR merged it: their auto-complete was armed and the vote met the last policy. Fix: check `autoCompleteSetBy` and the live policy first; if the vote would complete the PR, ask. *Rock rule: a vote can be a merge.* Pack: `harness/project/RULES.md`.

> **P3. Closing a stranger's thread.** The agent marked another reviewer's thread `Fixed`, assuming it could resolve what it fixed. Fix: push, reply with the commit, leave it `Active`. *Rock rule: only the starter closes.* Pack: `rules/project/pr-thread-resolution.md`.

> **P4. Comments that missed.** A thread anchored outside the diff never rendered, and drafts carried unwanted patches. Anchors must sit on diff lines. Fix: name the problem; anchor on a changed file; offer a small fix only where no design choice is needed. *Rock rule: name the problem, anchor on the diff.* Pack: `skills/pr-review/COMMENT-STYLE-NOTES.md`.

> **P5. Lanes that over-claimed.** A lane called a test assertion vacuous; another said a change reached templates it does not. Lanes read partial context. Fix: the main agent reads the diff first and checks each claim against code. *Rock rule: check a claim before you repeat it.* Pack: `skills/pr-review/SKILL.md`.

> **P6. Green build, stuck PR.** `main` moved, so the policy build expired, and a plain pipeline run does not attach to the policy. Fix: class the build against `main`'s tip; re-queue through the policy action. *Rock rule: re-queue the policy, not the pipeline.* Pack: `skills/pr-merge/SKILL.md`.

> **P7. Two fixes, one symptom.** Merging `main` into a branch silently retired part of an already-shipped fix. Two designs touched the same files, and the merge kept one. Fix: state the trade-off in the PR and get a human yes; prove the net change with patch diffs. *Rock rule: prove nothing was lost.* Pack: `skills/merge-conflict/SKILL.md`.

> **P8. The allowlist that did nothing.** A global allowlist is ignored when default rules are extended, with no warning. Fix: a rule-scoped allowlist and a smoke test (one case must fire, one must pass). *Rock rule: test a scanner with a known hit.* Pack: `scripts/secret-scan.sh`.

## QA and deploy (Q1 to Q5)

Tests are not the world. Five stories.

> **Q1. Green tests, dead fix.** The mock assumed a library rejects on abort; the real one resolves, so code checking only in `catch` never ran. Fix: verify once against the real dependency, at the real failure boundary. *Rock rule: tests prove your model, not the world.* Pack: `rules/global/BUG_FIXING.md`.

> **Q2. A flash too fast to see.** A 1.5 s highlight could not be captured. Screenshot timing missed the short tint. Fix: observe the resting layout; test transient states with a throwaway spec on the mocked API. *Rock rule: flows watch resting states.* Pack: `skills/flow-schema/SKILL.md`.

> **Q3. One lucky run.** A model-behaviour fix looked proven after one run, but behaviour varies. Fix: the baseline on `main` must show the bug (1 of 15 runs, else stop); repeat runs; add control prompts. *Rock rule: many runs, with controls.* Pack: `skills/regression-test-placement/SKILL.md`.

> **Q4. A contract that lied.** A contract said no nightly test pack exists, but one did. Nobody had checked the contract's facts in code. Fix: verify contract claims with `git grep` on `origin/main` of every repo; record a weaker check as a waiver. *Rock rule: check a contract's facts in code.* Pack: `skills/story-refinement/SKILL.md`.

> **Q5. Locked doors on QA and dev.** A test login failed (wrong tenant), MFA prompts varied, and dev was unreachable from the laptop. Roles, tenants, and a private endpoint gate each door. Fix: ask for the role first; use a same-tenant test account with TOTP; record "dev: not reachable from this host". *Rock rule: name what you could not reach.* Pack: `skills/e2e-verification/SKILL.md`.

## Comms (C1 to C5)

Words are tools. Five stories.

> **C1. Numbers in reports.** Reports showed vote integers, merge-status codes, thread ids, and hashes; the author complained on three days. No rule translated tracker codes. Fix: a vocabulary table in the context file, UI words, one raw anchor at most. *Rock rule: words, not codes.* Pack: `harness/project/AGENTS.md`.

> **C2. Dense, with undefined labels.** Status dumps used labels nobody defined ("step 3e"). Length was not the cause. Fix: verdict first, labelled sections, one decision at the end. *Rock rule: define a label where you coin it.* Pack: `skills/morning-brief/SKILL.md`.

> **C3. Drafts with extras.** Drafts carried background, emoji, and sign-offs; PR text repeated "Fixes N" and "suite passing". "Never shorten a draft" was read as "add". Fix: drafts say exactly what was dictated; a forbidden-wording table. *Rock rule: write what was dictated, add nothing.* Pack: `skills/pr-creation/SKILL.md`, `rules/project/ado-ticket-voice.md`.

> **C4. The Slack post that collapsed.** A post collapsed into one line and links did not render. Markdown content is not rendered, and links need rich-text elements. Fix: post a `blocks` rich-text payload; test the format in a DM first. *Rock rule: test the format in a DM.* Pack: `skills/pr-and-team-comms/SKILL.md`.

> **C5. Prompts that always said yes.** The author kept saying "do not prompt me when everything is in order". The gates were followed as written, and always got "yes". Fix: turn always-yes prompts into fact checks; skill-directed moves need no prompt; keep approval for posts with an audience. *Rock rule: if the answer is always yes, check facts.* Pack: `harness/project/RULES.md`.

## Vault (V1 to V6)

The wall can crack too. Six stories.

> **V1. Three owners in three days.** The vault write path changed three times in three days (a subagent, an advisor, the main agent). Nobody named the contract's owner. Fix: one owner, written exceptions. *Rock rule: one owner per contract.* Pack: `harness/global/WATCHDOG.yml`.

> **V2. The missed write-back.** A missing write-back was noticed days later. The check ran at concern severity, a silent card. Fix: blocker severity; drive the exit from the `turn_end` hook; state the fact one turn before closing. *Rock rule: a check nobody sees is no check.* Pack: `harness/extensions/global/end-session.ts` (the severity setting is yours to add to `harness/global/WATCHDOG.yml`).

> **V3. The $265 advisor bill.** 6,991 per-turn reviews cost about $265 in 14 days; 83% made no tool call. Review ran per tool round. Fix: `reviewMode: agent-end` (about nine times fewer reviews). *Rock rule: review at the end of a run.* Pack: `harness/global/WATCHDOG.yml`.

> **V4. The header that vanished.** An edit at a stale line number can delete a neighbouring log header. Edits used line numbers from an old read. Fix: read the tail, append after it, copy the exact `[path#TAG]` header. *Rock rule: read the tail, then append.* Pack: `vault/schema.md`.

> **V5. Retiring a policy by regex.** A marker policy was stamped across 223 files. A blind regex strip corrupted instruction prose, because mechanical edits ran over instruction text. Fix: hand-edit instruction files; diff live files against what the human approved. *Rock rule: never regex-edit instructions.* Pack: none.

> **V6. Two lost days.** A test run dated one day ahead left a guard line, so the first real run skipped two days. Fix: the script reads guard lines and backfills oldest first (cap 21 days); test in a sandbox copy. *Rock rule: test in a copy, never on the real vault.* Pack: `automation/slack-ingest/run.sh`.

## Skill drift: when recipes fight

**What.** Skill drift is two skills, or a skill and a rule, that say different things. **Why.** Agent obeys the nearest recipe. If recipes fight, it picks one and you never know which.

### Contradictions and copies

| ID | Two places disagreed | The fix, and the law |
|---|---|---|
| D1 | The story command routed "Ready for Development or later" to Session B. The skill took only "Ready for Development". | One place routes. The command passes the state. |
| D2 | The bug skill started services from a detached shell. A rule forbade it. | The rule wins. Use the `services` tool. |
| D3 | Six skills ran git in `-bare` paths. A guard forbids it. | Use task-folder links and the `main` folder. |
| D4 | One skill stashed a committed fix. Another said that saves nothing. | `git diff --quiet HEAD -- <files>` picks: stash if uncommitted, checkout from `origin/main` if committed. |
| D5 | One rules file said skill-directed moves need no prompt, then said ask. | One statement. Exceptions in one list. |
| D6 | The bug skill let the agent write `Closed`. Others forbade it. | The tester closes. |
| D7 | Is `Resolved` a "review or done" move? Rules asked. Skills did not. | Name the four states the agent writes and the three it never writes. |
| D8 | The script symlinks `.env`. Two skills said "copy". | The script is the truth. |
| D9 | One skill kept the old board after the rule changed. | Skills point at the rule. They never hold the value. |
| D10 | The bug state order changed three times in five weeks. | One ladder note plus `get_type`. Skills hold triggers only. |
| D11 | Four PR-build command lists. A story passed its gate and failed CI. | One table, checked against each PR pipeline YAML. |
| D12 | The router omitted 7 skills. | A row for every skill. |
| D13 | `tasks-deployed-to-qa` takes an environment input but checks QA only. | State the limit, or implement it. |
| D14 | A rollout changed the default channel in one skill. Three more kept the old one. | Constants in one file. Grep every copy. Second reviewer. |
| D15 | A folder move left stale paths in six skills and 56 dangling symlinks. | Grep, grep again, remove generated links. |
| D16 | Skills told the human to type `/move` after the tool existed. | When a tool replaces a step, search every skill for it. |
| D17 | An older skill copy in a memory cache lacked a step. | One copy. Check the roster for twins. |
| D18 | Port numbers copied into three skills and a registry page. | The starter of the service owns ports. |
| D19 | A skill bound an advisor an audit said no roster defined. [INFERENCE] The audit looked in the wrong place. | Verify a binding in a headless run. |
| D20 | Skills cite each other by step number. A renumbering broke three. | Cite by heading. |
| D21 | The state-move table sat in 4 skills, the re-fetch rule in 6. | One shared rule or context file. |
| D22 | A note claimed a Monday catch-up. A skill claimed all four agent files used the debugger override. | Read the target file before you claim. |

### What a teammate's guide showed

A teammate's guide listed 61 practices. Against 24 skills: 8 covered, 27 partial, 26 missing. Six groups were folded in (13 files touched, two new skills). QA and prod release steps stayed out on purpose: the author does not own releases.

### Claims not proven yet

Do not present these as proven. Each is a test you owe.

- `tool-call-auditor`: a live smoke test ran with no dialog. The cause stayed open. No automated test.
- Local auto-login with `flow-runner`: not run end to end. Mode presets on Ctrl+0 to 4: key delivery not confirmed.
- `pr-comments` reviewer mode and colleague-branch pickup: written, never run on a real PR.
- Returned-bug Step 0, the mutation check, the self-review gate: not exercised on a live bug when added.
- The pre-PR security gate: nine verification steps planned, results not recorded.
- The nine chat rules, and `/clear` returning to the launch root: no live confirmation.
- A poller framework: design only. [INFERENCE] A detached mode survives the broker.
- Vibe mode for the ticket pipeline: the director loses shell, MCP, and `services`. Proposal only.
- The reference `main` folder is shared: uncommitted changes there affect other sessions.

## Meta-lessons

Nine laws from the fights above.

1. One home per fact. Facts in the context file, procedures in skills, gates in rules plus config, mechanics in scripts.
2. Reference, do not copy. Cite by heading, never by step number.
3. Every decision triggers a repo-wide search for the old wording, plain-word synonyms too. Then a second reviewer.
4. Audit on a schedule. One read-only pass after three months found 23 contradictions.
5. A rules file that contradicts itself is a bug. Keep exceptions in one list.
6. Skills made mid-session do not load. Test fresh.
7. "Known gaps" in a decision is the early warning for drift. Make each gap a task or an owner.
8. Order edits that share a file. One change can renumber every later line.
9. A human who changes a rule twice was guessing the first time. Ask why before the fourth edit.

## Team and process lessons

The team learned too. The short list.

### From the retrospective (nine people, twelve action items)

- Keep: quality over speed, with engineers owning estimates. Open talk about surprises. Quick stakeholder updates.
- Stop: many chat tools (pick one channel). Merging to `main` untested. PRs waiting days for review. AI-driven PR volume outrunning reviewers (split big PRs early). Under-specified tickets (name who owns readiness). A UAT environment that reuses QA. Last-minute deploy asks (name one person who may decline). Many voices to the client (use one contact).
- Start: share the retro board a day early. Refine the backlog before every planning. Write a Definition of Ready and a Definition of Done. T-shirt size requests before design.

### From the launch month

- Turn the brain-dump plan into an ordered task list with owners and a week-by-week timeline. Name who confirms Go or No-Go.
- Split "technically live" from "launched". Freeze scope. New asks go through product and delivery leads.
- Route feedback through named testers. Make "what is deployed where" a cheap query: testers once judged pre-fix code.
- Escalate shared blockers early. Name a backup for every credential. Write a handover plan before a lead leaves.
- Release gate: zero critical and zero high static-scan findings. Document false-positive classes as waivers.
- Commit to a regression test per bug fix, the regression suite on dev before answer-changing merges, and local tests against a client-like environment.
- Code freeze before go-live. Name an incident owner. Keep one source for dates.

### About agents in a team

- Ticket quality is the multiplier. A thin ticket bounces. That matches the retro's Definition of Ready.
- Bugs and stories run alone to an opened PR. Humans own posts with an audience (except the fixed PR-open note), merge, release, and the closing states.
- The tester closes bugs. The product owner accepts stories.
- An agent's review is a lane, not a vote.
- Expected evidence: reproduction, failing test, mutation check, before and after image, a click-path comment for the tester.

## The numbers

Numbers are quotable. Each carries its context.

| What | Number | Context |
|---|---|---|
| The window | about 160 sessions, 680 to 700 human turns, two weeks | Main sessions only. Agent-side logs outnumber top-level ones 2.7 to 1. |
| Prompts | median 61 characters (11 words); 15% saved commands | Terse and dictated. Typos are normal. |
| Accepted replies | up to 3,400 characters; at least 35 one-word answers | Confusion came from codes and labels, not length. |
| Confusion and friction | 28 cases: 11 rule missing, 9 broken by the main agent, 3 followed but rejected | 6 of 8 confusion cases had no rule that could help. |
| Session outcomes | 300 sessions in five weeks: 31% harness work, 23% aborted | Ticket and PR sessions aborted 29%. |
| Habits | 110 `/clear` in five weeks; 31 shell calls in the first six calls of 60 sessions | A resume file per ticket was proposed. After the `read` rule: 2 shell `ls` calls before, 0 after. |
| Advisor economics | 6,991 reviews, about $265, 14 days | 83% made no tool call. `agent-end` gives about 9 times fewer. |
| Size of the machine | 27 project skills, 7 wiki skills, 11 commands, 12 rules, 4 agents, 3 extensions | From 15 skills in early September. |
| Model-behaviour proof | baseline held in 14 of 15 runs; the fix passed 5 of 6 criteria | A five-run recheck did not reproduce the miss. |
| Tool limits | shell cap 300 s; Playwright 30 s; a gateway probe hung past 60 s | Plan for them in scripts. |
| Vault and papercuts | 279 decision pages; 30 papercuts in 30 days | Decision pages carry "Known gaps". |

# Make It Yours

You are new. The org is new. Do not copy blind. Copy the laws. Rewrite the names. Walk the plan below, in order.

## The plan at a glance

| When | Goal | Done when |
|---|---|---|
| Day 1 | Light the fire | The harness loads your files, a guard blocks a bad call, placeholders are filled |
| Week 1 | One bug, end to end | One real bug goes from ticket to opened PR, with evidence |
| Weeks 2 to 4 | Walk the road | PR, review, merge, QA check, vault, one story, one morning brief |
| After that | Grow | Your own skills, from your own papercuts |

## Day 1: light the fire

**What.** Install the harness. Copy the pack. Fill every placeholder. Prove a guard bites.

**Why.** All the craft hangs on the harness loading your files. A bad first hour costs a day.

**How.** ("The Workshop" has the long version.)

1. Install your harness (the author used OMP). Run it once.
2. Make the tasks root: `~/work/<PROJECT>/tasks`. Start every session there.
3. Bare-clone each repo as `<repo>-bare` beside `tasks/`, with `skills/repo-onboarding/SKILL.md`. Put every file of `scripts/` in the tasks root, the two `gitleaks` files too. Edit the `excluded_repos` array in `scripts/setup-task-branch.sh`.
4. Make `<tasks-root>/.omp/`. Copy in `harness/project/*`, `skills/`, `rules/project/`, `commands/`, `agents/`, and `harness/extensions/project/`. Copy `harness/global/*`, `rules/global/`, and `harness/extensions/global/` into `~/.omp/agent/`.
5. Make `mcp.json` from `harness/mcp.template.json`. Export the token variables in your shell before you launch. Pin the Playwright MCP version. Keep the secrets file outside git.
6. Fill every placeholder (table below). Search for `<`.
7. Restart. Open a fresh session in the tasks root. Ask which skills it sees. Run `/pr-status`: it only reads, so it is a safe first call.
8. Prove a guard. Ask the agent to read a file above `tasks/`. See the block. Ask it to kill a process it did not start. See the block.
9. Start your papercuts log: one line per time sink (date, symptom, fix, project).

**Where in pack.** `harness/`, `scripts/`, `skills/repo-onboarding/SKILL.md`, `harness/mcp.template.json`. Give your agent `FOR-AGENTS.md` too: its Section 9 is the adoption procedure.

> Rock rule: restart after every change. Test in a fresh session.

## Week 1: one bug, end to end

**What.** Take one small, real bug. Run `/bug <number>`.

**Why.** One full lap teaches more than ten pages. Every gate shows itself in the order it bites.

**How.**

1. Pick a bug with a visible symptom and one repo. Ask a teammate to confirm it is small.
2. Run `/bug <number>`. Watch bootstrap make the task folder. Check it yourself with `read`.
3. Watch the agent reproduce first. No repro, no fix.
4. Read the root cause. It must name `file:line`. Check one citation by hand.
5. Watch the failing test come first. Then the smallest fix.
6. Run the mutation check yourself once. Remove the fix: the test must fail. Restore it: the test must pass.
7. Demand one live check against the real dependency. A mock is not proof.
8. Read the self-review and the security gate report.
9. The PR opens. Read it as a stranger: title, template, evidence, work-item link. Re-fetch the work item and check the link.
10. Hold the state at `Ready for Fix` while the PR is open. `Closed` belongs to the tester.
11. Tear down. Nothing should still run. Write each lost hour into the papercuts log.

**Where in pack.** `skills/bug-workflow/SKILL.md`, `commands/bug.md`, `skills/regression-test-placement/SKILL.md`, `skills/pr-creation/SKILL.md`.

> Rock rule: reproduce, test, fix, prove. In that order.

## Weeks 2 to 4: the PR road, review, vault

**What.** Walk the rest of the road. Then plant the vault.

**Why.** After the fix the road is long: review, conflicts, merge, deploy, retest. Each stop has its own skill.

**How.**

1. Week 2: live a PR's life. `/comments <pr>` for review threads. `/conflict <pr>` for a conflict. `/pr-merge <pr>` when green. Then `post-merge`. Ask `/qa-deployed` before the tester retests.
2. Week 3: review someone else's PR with `/ado-review <pr>`. Read the three lane reports and the verified summary before you post. Check auto-complete before you vote.
3. Week 3: build the vault (six steps in "The Long Memory"). File one meeting, one decision, one lint report.
4. Week 4: run one story as two sessions. Refine with `/triage` or `/story`. Run Session B in a fresh session. Let a contract gate fail once, on purpose. Watch the bounce.
5. Week 4: add the morning brief. Test `board-ingest` and `slack-ingest` by hand on a sandbox copy before you install cron (`automation/README.md` says how).
6. Fix the first gaps in the list below.

**Where in pack.** `skills/pr-comments/SKILL.md`, `skills/pr-merge/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/pr-review/SKILL.md`, `skills/story-workflow/SKILL.md`, `skills/morning-brief/SKILL.md`.

## What to keep, what to adapt

**What.** Keep the laws. Adapt the facts. **Why.** The laws came from falls. The facts came from one client.

| Keep: the laws | Adapt: the facts |
|---|---|
| Re-fetch after every tracker write | Your tracker, state ladders, vocabulary table |
| A ticket is a contract. A thin one bounces. | Ticket template, Definition of Ready |
| Reproduce, test first, mutation check, live verify | Test commands, the PR-build table |
| One boring script wires every folder | Repo roster, standing exclusions |
| Guards in code for hard laws. Fail closed. | Which paths, tools, and processes you guard |
| The human owns the end of the ladder | Who closes: your tester, your product owner |
| Gates by facts, not always-yes prompts | Which posts have an audience on your team |
| A vault with a schema and an append-only log | Vault folder, cron times, time zone |
| A papercuts log | Models per role, login method, environments, scan tool |

## The placeholder list

**What.** Every `<NAME>` token you must replace. **Why.** An unfilled placeholder is a silent bug.

| Placeholder | Meaning | Where you meet it |
|---|---|---|
| `<PROJECT>` | the platform name, and the workspace folder name | everywhere; start at `harness/project/AGENTS.md` |
| `<CLIENT>`, `<EMPLOYER>`, `<PRODUCT>` | the client org, the consultancy, the assistant product | `harness/project/AGENTS.md` |
| `<ADO_ORG>`, `<ADO_PROJECT>`, `<ADO_PROJECT_URL_ENCODED>` | tracker org, project, and the project name with `%20` for URLs | `harness/mcp.template.json`, `skills/my-pr-status/SKILL.md` |
| `<AREA_PATH>`, `<BOARD>`, `<AREA_PATH_1>`, `<AREA_PATH_2>` | tracker area path and board | `rules/project/ado-area-path.md`, `automation/board-ingest/prompt.md` |
| `<QA_URL>`, `<DEV_URL>`, `<DEV_API_URL>` | web-app and API address per environment | `harness/project/AGENTS.md`, `skills/post-merge/SKILL.md` |
| `<YOUR_EMAIL>`, `<YOUR_EMAIL_ESCAPED>`, `<YOUR_DISPLAY_NAME>`, `<TEST_USER_EMAIL>` | your tracker identity and the test user | `harness/project/config.yml`, `harness/project/AGENTS.md` |
| `<TECH_LEAD>`, `<QA_TESTER>`, `<PRODUCT_OWNER>`, `<TEAMMATE>`, `<MANAGER>` | people, by role. Real names live in vault `people/` pages | `harness/project/AGENTS.md`, `skills/pr-creation/SKILL.md` |
| `#<team-channel>`, `#<eng-channel>`, `#<all-teams-channel>` | Slack channels | `harness/project/AGENTS.md`, `skills/pr-and-team-comms/SKILL.md` |
| `<PIPELINE_ID>`, `<E2E_PIPELINE_ID>` | pipeline definition ids (deploy, API e2e regression) | `skills/deployed-version-check/SKILL.md`, `skills/post-merge/SKILL.md` |
| `<TENANT_ID>`, `<SUBSCRIPTION_ID>` | cloud ids. Keep them on a vault project page for infra | `skills/deployed-version-check/SKILL.md` |
| `<STANDARDS_REPO>` | the tracker repo that holds Git and PR standards | `harness/project/AGENTS.md`, `skills/pr-creation/SKILL.md` |
| `<TEAMMATE_1>`, `<IDENTITY_ID_1>`, `<REPO_ID_*>`, `<RESOURCE_GROUP_*>`, `<APP_SERVICE_*>`, `<QA_SUBSCRIPTION_NAME>`, `<REGION>` | standing reviewers, repo ids, and cloud names for PR creation and the live-config check | `skills/pr-creation/SKILL.md`, `skills/deployed-version-check/SKILL.md` |
| `<VAULT_ROOT>`, `<TIMEZONE>`, `<ENV_VAR_NAME_HOLDING_BASE64_PAT>`, `<PATH_TO_E2E_SECRETS_FILE>`, `<ENV_VAR_NAME_HOLDING_SLACK_XOXP_TOKEN>` | your vault folder, your cron day boundary, and the names (never the values) of secret variables and files | `harness/global/APPEND_SYSTEM.md`, `automation/README.md`, `harness/mcp.template.json` |

## Open gaps worth fixing first

**What.** Real drift, checked in the pack's files. **Why.** The clear-cut text drift is fixed in the shipped files. What is left needs a human or design call. Fix the top of this list in weeks 1 to 4. `FOR-AGENTS.md` (Section 8) keeps the longer list for your agent.

**How.** Work down the list.

1. Scanner config. Copy `scripts/gitleaks.toml` and `scripts/gitleaks-report.tmpl` into the tasks root, next to `scripts/secret-scan.sh`. The config only extends the default rules. Add a rule-scoped allowlist block and smoke-test it: one case must fire, one must pass (fall P8). Not shipped at all: a plan template, the plan-mode hook (fall A7), and the papercuts file. Make them.
2. Git against bare repos. `skills/daily-work-poll/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md`, `skills/ticket-triage-profile/SKILL.md`, and `skills/story-refinement/SKILL.md` still read `-bare` paths. The guard blocks them. Point them at the `main` folder or task-folder links (fall D3).
3. Resume routing. `commands/story.md` routes "Ready for Development or later" to Session B. The contract gate in `skills/story-workflow/SKILL.md` passes only on exactly `Ready for Development`. A resumed story in `In Development` would be sent back to refinement. Decide how a resume passes the gate (fall D1).
4. Unpinned browser. `harness/mcp.template.json` says `@latest` and sets no isolation flag. Pin the version and run isolated (fall H10).
5. Unproven claims. Run each item of "Claims not proven yet" once, live, before you trust it.

## Grow your own skills

**What.** A skill is a recipe you wrote because you did the thing twice.

**Why.** Every skill here began as a papercut. The set grew from 15 skills in early September to 27 project skills and 7 wiki skills. That came from this habit alone.

**How.**

1. Do the thing by hand once. Note each step and each trap.
2. Do it a second time. Now write the recipe. Not before: you guess wrong. Not after the third time: it is late.
3. Shape it like `skills/wiki-sync/SKILL.md`: a header with `name` and a `description` that starts "Use when" (the agent sees the description, so it is the trigger), then When, Inputs, Steps, Gates, Writes, Log.
4. Keep one home per fact. Facts in `harness/project/AGENTS.md`, procedures in skills, gates in rules plus config, mechanics in scripts. Reference. Never copy. Cite by heading.
5. Add a row in `skills/workflow-router/SKILL.md`. Add a slash command only for a thing you type daily: under ten lines, naming the skill, passing the argument.
6. Test in a fresh session. A skill made mid-session does not load.
7. After any decision, search the whole pack for the old wording, plain-word synonyms too. Then ask a second reviewer.
8. Keep the papercuts log. When something hurts, sort it. Rule missing: write one. Rule broken: add a guard or a gate. Rule followed but wrong: change the rule.
9. Audit every three months. Changed a rule twice? Stop. Ask why. The first version was a guess.

**Where in pack.** `skills/wiki-sync/SKILL.md`, `skills/workflow-router/SKILL.md`, `skills/third-party/` (upstream skills; credits in `skills/third-party/CREDITS.md`; the workflow calls `grilling` and `research` by name), `harness/project/AGENTS.md`.

> Rock rule: second time, write the recipe. Third time, trust the recipe.

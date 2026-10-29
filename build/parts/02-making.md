# Triage: Know Before You Dig

Cave elder says: dig in wrong spot, lose a week. Look first. Think first. Then dig.

This part covers the work before any code. A ticket arrives. You decide what it is. You make sure everyone understands it. Only then you build.

Words, once:

- **Ticket** = one job in the tracker (here: Azure DevOps). Also called work item.
- **Bug** = something works wrong. **Story** = something new to build.
- **State** = the stage of a ticket, like `New` or `Ready for Fix`.
- **AC** = acceptance criterion. One sentence a test can pass or fail.
- **Skill** = a recipe file the agent reads. **Command** = a saved prompt like `/triage 12345` that loads a skill.

## Two paths: Bug and Story

**What.** Bugs and Stories take different roads.

**Why.** A bug already has proof: you can make it break. So the bug road is one session. A story has no such proof, so it gets two sessions, with the ticket as the handoff note between them.

**How.**

1. Bug: bootstrap the folder, reproduce, fix, prove, open the PR. One session.
2. Story: Session A talks to you and writes the contract into the ticket. Session B starts blank, reads only the ticket, builds.
3. The router skill picks the road from ticket type and state.

```
Bug   : ticket -> bootstrap -> bug-workflow ------------> PR
Story : ticket -> Session A (grill, contract) -> ticket
                  Session B (gate, build)     -> PR
```

**Where in pack.** `skills/workflow-router/SKILL.md`, `commands/bug.md`, `commands/story.md`, `harness/project/AGENTS.md`.

> Rock rule: Bug reproduction is the contract. Story contract is written in the ticket.

## Bug triage: is it real, is it ours

**What.** Before hours of work, decide: does this bug need you now?

**Why.** Boards fill with bugs already fixed, already taken, or waiting on a tester. Guessing wastes days.

**How.**

1. Fetch the ticket fresh. Read the state: `New` = nobody looked; `Ready for Triage` = looked at, not yet shown to break; `Ready for Fix` = shown to break.
2. Check if someone picked it up (next section). Read the linked pull requests (PR = request to merge a branch).
3. Yours? Bootstrap it. Bootstrap moves `New` to `Ready for Triage`, nothing more. Never write `Ready for Fix` until the bug breaks on your own machine.

**Where in pack.** `skills/ticket-bootstrap/SKILL.md` (Step 5), `skills/bug-workflow/SKILL.md` (Step 2).

## The actionable-bug rules

**What.** Four rules say when a board bug has work left for you.

**Why.** "Which bugs need me?" got a different answer each time. Rules end the argument.

**How.** A bug has work for you when at least one is true:

1. **Open PR, unresolved comments.** An Active linked PR has a thread a person wrote and nobody resolved. System threads ("policy updated", "added reviewers") do not count.
2. **Triage, not picked up.** State `Ready for Triage`, nobody on it.
3. **New, not picked up.** State `New`, nobody on it.
4. **Merged PR, tester moved it back.** A linked PR is merged. A tester moved the state back and commented why.

"Picked up" means one of: a task folder exists; a branch or worktree exists; a linked PR exists or a comment claims the work; a live agent session works on it. A name in the assignee box is not "picked up". Old session logs are not evidence: they list every board id.

The board is an **area path**, not an iteration path. For rules 2 to 4 skip `Closed`, `Cancelled`, `Duplicate`. For rule 1 do not skip them: a closed bug can hold an open PR.

**Where in pack.** The mechanical table is `automation/board-ingest/prompt.md` (Step 7). The brief is `skills/morning-brief/SKILL.md`.

> Source gap: the four rules come from the author's wiki note, not from the pack. Only the board table is in the pack.

## Ticket triage with `/triage`

**What.** `/triage 12345` explains a ticket, grills you, and writes a spec into the ticket. Any ticket type.

**Why.** Agents misread thin tickets. So do you. The agent explains until you can teach it back.

**How.**

1. Run it on the big model. The command says so; it does not check.
2. Load the profile. `ticket-triage` is tool-neutral. `ticket-triage-profile` binds it to your tracker, fields, repos. A profile rule beats a generic rule.
3. Pre-flight: id is all digits; look for an existing task folder and move into it; never run the branch script to triage.
4. Fetch everything: type, state, every long text field, area and iteration path, tags, comments, links, every image. Make the download folder first; the tool will not.
5. Ground in code: one read-only scout per candidate repo, in one call. Each reports `file:line`, current behaviour, and whether the wanted behaviour already exists. Scouts read `origin/main`, not a stale worktree.
6. Search the vault by ticket id and keywords (never write to it here). Check the main claim against the code: `confirmed`, `contradicted`, or `insufficient detail`. Run nothing.
7. Brief (8 bullets at most). Walkthrough: 3 to 6 topics, one per turn. Then the teach-back gate: you explain the ticket in your words, the agent compares it with a private checklist and re-explains gaps. Pass only when all points are covered. Never skip.
8. Grill (below). Draft the spec in a fenced block, one version per turn. Write only after "approved".
9. Write the spec as a **comment**. Never touch the description. Re-fetch and check.
10. Offer a state move. Bug in `New`: offer `Ready for Triage`. Never offer `Ready for Fix`.

Bug heading: `## Triage Specification`. Story heading: the contract heading. If a named outsider must answer first, write `## Triage Notes` instead.

**Where in pack.** `commands/triage.md`, `skills/ticket-triage/SKILL.md`, `skills/ticket-triage-profile/SKILL.md`.

## Story refinement, Session A

**What.** A talk with you. Its only product is the ticket: a full Agent Contract in the description and state `Ready for Development`.

**Why.** The old way did talk and build in one session, so the ticket was never tested as a handoff. Now Session A ends and Session B lives on the ticket alone.

**How.**

1. Fetch the story. Note the description and its format (HTML or Markdown).
2. `Backlog`: move to `In Refinement`, re-fetch. Past `Ready for Development`: stop.
3. Read code through the `main` worktrees. Do not run the branch script. The grill may shrink, split, or reject the story, and the script makes branches in every repo.
4. Grill.
5. Write the contract into the **description**. Read-modify-write: take old text, append the contract, write the whole field back. Match the format: HTML field, HTML contract. Use `update_batch`, which takes a format; plain `update` does not.
6. Re-fetch. Contract renders. Human text intact.
7. One short comment: refinement done, tag the product owner. Comments carry reasons and questions, never the contract.
8. Ask you. Move `In Refinement` to `Ready for Development`. Re-fetch.
9. Add a vault log entry. End the session.

**Where in pack.** `skills/story-refinement/SKILL.md`, `commands/story.md`.

## The Agent Contract

**What.** Six sections in the ticket. All mandatory. No `TBD`.

**Why.** It is the full instruction for a builder who was not in the room. The Session B gate reads it by machine rule, so a gap cannot hide.

**How.**

```markdown
## Agent Contract (Ready for Development)
### Acceptance criteria (restated, testable)
AC-1: ... (a test or live check can pass or fail it)
### Resolved questions
Q: ... / A: ...
### Affected repos
<repo list>, explicit non-goals, repos NOT to touch
### Verification plan
per AC: the test command or live check that proves it
### Deploy-order notes
what the user sees for each merge or deploy order
### Stop conditions
named conditions that force the builder to block and comment
```

**Where in pack.** `skills/story-refinement/SKILL.md` (Step 4), `skills/ticket-triage-profile/SKILL.md` (Spec targets).

> Source gap: "search every repo on `origin/main` before the contract is final" comes from lessons. The bundled refinement skill does not say it. Add it.

## Why a story never starts without the contract

**What.** A gate at Session B Step 0. No contract, no work.

**Why.** An agent that makes do with a thin ticket builds the wrong thing fast. The refusal is the quality tool. The team retro asked for a Definition of Ready. This gate is one made of code.

**How.** Pass only if both hold:

1. State is `Ready for Development`.
2. The description, or the newest comment headed `## Agent Contract (Ready for Development)`, has all six sections non-empty with no `TBD`. A `(1/2)` and `(2/2)` split counts as one.

On failure: comment naming each gap and tagging the refiner or product owner; move back to `In Refinement`; re-fetch; stop. No folder, branch, or code.

**Where in pack.** `skills/story-workflow/SKILL.md` (Step 0), `skills/ticket-bootstrap/SKILL.md` (Step 2).

## Grilling

**What.** The agent asks hard questions, one at a time, each with its recommended answer.

**Why.** You hide doubts from yourself. Ordered questions pull them out. One per turn keeps you thinking.

**How.**

1. Load the `grilling` skill.
2. One question per turn, with a recommended answer.
3. Ground it in code: "The ticket says X, but `file:line` does Y. Which wins?"
4. A tool can answer a fact: look it up. Only ask you decisions.
5. Also grill the task breakdown: tier, who, what depends on what.
6. Stop when: every AC testable; every doubt resolved or deferred with an owner; repos touched and untouched listed; one named check per AC; deploy-order effects known; stop conditions written; task list agreed.

**Where in pack.** `skills/third-party/grilling/SKILL.md`, used by `skills/ticket-triage/SKILL.md` (Step 6) and `skills/story-refinement/SKILL.md` (Step 3).

## When to split a ticket

**What.** The grill can show one ticket is really two, or too big.

**Why.** Big tickets make big PRs, and review waits for days. The retro said: split large PRs into smaller tickets from the start.

**How.**

1. Signals: an AC maps to a repo the contract does not name; two pieces share no files; a deploy order hurts users; an outsider must decide something.
2. Finish and verify the first ticket's contract.
3. Draft each new story in a fenced block: title, description, ACs, area path, a related link back. Show it.
4. Create it only after approval. Re-fetch. Report the id.
5. In Session B, never widen scope. Use the escalation rule (comment with `file:line`, tag a person, `Blocked`, stop).
6. A pre-existing hole the security gate finds becomes a new Bug, not part of this PR.

**Where in pack.** `skills/ticket-triage-profile/SKILL.md` (Next step), `skills/story-workflow/SKILL.md`, `skills/pr-security-gate/SKILL.md`.

## Area path and iteration path

**What.** **Area path** = which team board owns the ticket. **Iteration path** = which sprint.

**Why.** Wrong area path and the ticket vanishes from the board. The board query uses it.

**How.**

1. Set the area path on every ticket you create or edit. The value lives in one rule file (it may be a temporary override). Skills point at the rule and never hold the value.
2. Use the work-item write tool, field `System.AreaPath`, never the CLI. Re-fetch.
3. You may change area path, iteration path, and self-assign without asking. Any other edit asks first.

**Where in pack.** `rules/project/ado-area-path.md`, `harness/project/RULES.md`.

# Bootstrap: Make the Cave

Cave elder says: every hunt needs a cave. Dry floor. Tools on the wall. Same layout every time. Then you never lose your spear.

Words, once:

- **Bare clone** = repo copy with history but no working files. One per repo.
- **Worktree** = second copy of the repo, own branch, same history.
- **Symlink** = a shortcut that points to a real folder.
- **LSP** = language server: "go to definition", "find references". **DAP** = how a debugger talks to a program.

## What bootstrap makes

**What.** One folder per ticket: one shortcut per repo, each pointing at a worktree on your task branch, plus code-intelligence config, plus the session moved inside.

**Why.** Tickets run in parallel. One folder keeps plans, evidence, and code together. One script builds it, so it never drifts.

**How.**

```
~/work/<PROJECT>/
  <repo>-bare/             bare clone per repo. Never touch
    main/                  reference worktree
    fix/<slug>/            your task branch worktree
  tasks/                   start the agent HERE
    setup-task-branch.sh   setup-task-lsp.sh
    BUG-12345-<slug>/      the task folder
      orchestrator -> ../../orchestrator-bare/fix/<slug>
      web-app      -> ../../web-app-bare/fix/<slug>
      ...one symlink per repo      docs/  plan/  review/
```

**Where in pack.** `skills/ticket-bootstrap/SKILL.md`, `scripts/setup-task-branch.sh`, `scripts/setup-task-lsp.sh`.

## Bootstrap, step by step

**What.** `ticket-bootstrap` has numbered steps. Keep the order.

**Why.** Each step stops a real mistake.

**How.**

1. **Step 0.** Glob for `*-12345-*`. If a folder exists, `move_session` into it first. Bootstrap refuses a second folder for one ticket.
2. **Step 1.** Fetch the ticket with the tracker tool. On failure, run the CLI login fallback and retry the tool. Never swap the tool call for a CLI read.
3. **Step 1b.** Bug: detect a returned bug (see the bug hunt).
4. **Step 2.** Branch on type. Bug goes to `bug-workflow`. Story only if `Ready for Development` with a contract; else back to refinement.
5. **Step 3.** Run the branch script. **Step 3a.** Look for a colleague's work in three places: ticket links, PRs per repo, remote branches. Found? Rerun the script with their branch name, work on top, never rewrite their commits, push to their open PR. (Written, never run on a real branch.)
6. **Step 4.** Never remove a symlink or delete a branch or worktree after the script ran.
7. **Step 4b.** Run the LSP script. Call `move_session` with the folder name.
8. **Step 5.** Bug in `New`: write `Ready for Triage`. Any other state stays. Story: do not set; check it is `Ready for Development`. Re-fetch.

Branches: `fix/<slug>` for a Bug, `feat/<slug>` for a Story. Folder: `{TYPE}-{NUM}-{very-brief-slug}`, TYPE uppercase (`BUG`, `STORY`, `RESEARCH`, `PR-REVIEW`). A ticketless research item uses `RESEARCH-00000-<slug>`.

Start the agent in `~/work/<PROJECT>/tasks`. Rules, skills, and tool servers load from the start folder only. The task folder links the shared config, so they survive `move_session`.

**Where in pack.** `skills/ticket-bootstrap/SKILL.md`, `harness/extensions/global/move-session.ts`, `harness/project/RULES.md`.

> Rock rule: Start at the tasks root. Move in on purpose.

## The branch script

**What.** `./setup-task-branch.sh <branch> <target_dir>`, run from the tasks root.

**Why.** Hand-made worktrees drift. A boring script does it the same way every time.

**How.** Per repo, the script:

1. Finds every `*-bare` folder in the parent of the tasks root.
2. Skips its standing exclusion (the retiring `legacy-agent` repo).
3. Makes the branch as a worktree off the default branch. Reuses it if present.
4. Symlinks the bare repo's root `.env` into the worktree. One edit changes every task's link. The script links. It never copies.
5. Makes one relative symlink in the task folder.

Rules:

- It makes the folder itself. Never `mkdir` it. Never delegate that.
- It refuses a second folder in the same `{TYPE}-{NUM}-` family under another slug. Reuse the name it reports.
- Read the folder listing yourself afterwards.
- `--pr <repo>` mode wires one repo for reviewing someone else's PR: fetches the branch, resets any stale local copy to the fresh head, makes no `.env` link.

**Where in pack.** `scripts/setup-task-branch.sh`, `skills/task-branch-script-internals/SKILL.md`.

> Ugh. Fall: A rerun made the branch in every bare repo, out-of-scope ones too. Later an agent tidied up and deleted five out-of-scope worktrees. The author needed them. Exclusions now live in the script.

> Rock rule: Never hand-roll worktrees. Never remove a link after setup.

## LSP and debug setup

**What.** `./setup-task-lsp.sh <task_dir>` makes the folder a place where code intelligence and debugging work.

**Why.** Without it the agent guesses symbols with text search, which misses shadowing and re-exports.

**How.** The script links the shared `.omp` config; installs every repo (`uv sync` for Python, `pnpm install` for the web app, `debugpy` where missing); installs pinned language-server tooling; writes `lsp.json`, `dap.json`, `pyrightconfig.json`, and a task-root marker. Then `move_session`. A subagent cannot move.

Debug notes:

- Name the adapter in every `debug` call. Generated adapters carry no file types.
- Python launch: `program` is the repo's `.venv/bin/uvicorn`. Never `--reload`; it forks a child the debugger cannot see.
- The web app has no process debugger. `infra` (Terraform) gets no language server.

**Where in pack.** `scripts/setup-task-lsp.sh`, `harness/project/dap.json`, `skills/ticket-bootstrap/SKILL.md` (Step 4b).

## Repo onboarding

**What.** What to do when a repo has no bare clone yet.

**Why.** The branch script only sees `*-bare` folders. A new repo is invisible until onboarded.

**How.** Follow `repo-onboarding`: find the repo in the tracker, make the bare clone, make the `main` worktree, link `.env`, add the repo to the standing facts file. Agents read `main` code through the `main` folder inside the tasks root (one symlink per repo). They never open the parent folder or bare clones. No `main` folder? Tell the author to create it with the setup script.

**Where in pack.** `skills/repo-onboarding/SKILL.md`, `rules/project/no-parent-folder-repo-access.md`, `harness/extensions/project/no-parent-folder-guard.ts`, `harness/project/AGENTS.md`.

## What the folder looks like after

**What.** The shape to expect.

**Why.** Later skills write to named places. Know them, find evidence fast.

**How.**

| Path | Holds |
|---|---|
| `<repo>` symlinks | worktrees. Use `read`, `git -C <task>/<repo>` |
| `plan/` | repro, fix plans, verification doc, return rounds |
| `docs/` | findings, attachments, `flow.yaml`, flow runs |
| `review/` | self-review diffs, `SECURITY-GATE.md` |

- Scratch, notes, commit-message files stay in the ticket folder. Never `/tmp`.
- `read` follows repo symlinks. `glob` works from the symlink down. `grep` fails on the symlink itself: use `git -C <task>/<repo> grep`.

**Where in pack.** `rules/project/task-files-in-ticket-folder.md`, `rules/project/tool-gotchas.md`, `harness/project/AGENTS.md`.

# The Bug Hunt

Cave elder says: bug is a beast in the dark. You do not swing at noise. You make it show itself. You hold it with a light. Then you strike once.

Words, once:

- **Reproduce** = make the bug happen on purpose.
- **Failure boundary** = the exact place where the wrong thing happens.
- **Root cause** = the real reason, not the symptom.
- **Worker** = a helper agent with one narrow job and no memory of your chat.

## The whole bug path

**What.** One session, folder to PR.

**Why.** The reproduction is the contract. If you cannot make it break, you cannot say you fixed it.

**How.**

```
bootstrap
  Step 0   returned bug? (skip if fresh)
  Step 1   start services, make it break
  Step 2   Ready for Triage -> Ready for Fix
  Step 2b  debugger, root cause
  Step 3   fix plan per repo, failing test first
  Step 4   live verify, mutation check, flow run, tear down
  Step 5   one commit per repo, self-review, security gate, PR
  Step 6-8 link PR, hold state, team line, vault record
```

A session told "Fix bug 12345" has consent to implement from its first message. Ask-first gates are review or done state moves and any Slack post but the PR-open line.

**Where in pack.** `skills/bug-workflow/SKILL.md`, `commands/bug.md`, `rules/global/BUG_FIXING.md`.

## Step 0: the returned bug

**What.** A tester moved your fixed bug back. Step 0 finds out why.

**Why.** The first fix missed a case. Doing it again fixes nothing.

**How.** Bootstrap Step 1b detects it from the full state history. POST set = `Resolved`, `Ready for Retest`, `Closed`. RETURN set = `New`, `Ready for Triage`, `Ready for Fix`, `Bug Test Failed`, `Reopen`, `Blocked`. Returned bug = history touched POST and now sits in RETURN. PR mode: only active PRs = open-PR mode; only completed or none = merged mode; both = stop and ask. Merged mode branch: `fix/<slug>-<N>-r<n>`.

Then, writing to `plan/return-r<n>.md`:

1. Collect evidence since the move: comments, repro-step edits, new attachments, PR threads. Found repro steps win; else copy the originals and say so.
2. Merged mode: QA build check. `git merge-base --is-ancestor <merge-sha> <deployed-ref>`, exit 0 = QA holds the fix. QA lacks it? Stop, record, draft a comment, write no state.
3. Reproduce on QA first (UI: `docs/flow-r<n>.yaml`, env `qa`, expect `broken`, you log in by hand). Then locally.
4. Decide:

| QA | Local | Action |
|---|---|---|
| breaks | breaks | Confirmed. Step 2 |
| breaks | clean | Match QA locally, 3 tries, change one variable each |
| clean or not run | breaks | Confirmed. Step 2 |
| clean | clean | Stop. Draft a comment asking the tester for environment, build, account, steps |

5. Vault: one line under `## Returns` in every outcome.

Never overwrite the tester's state. Moving to `Ready for Fix` asks you first. Fix plans are new files, `plan/fix-plan-<repo>-r<n>.md`, each with `## Why the previous fix failed`: merged commit, the `file:line` it changed, the case it missed. Never edit earlier plan files.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Step 0), `skills/ticket-bootstrap/SKILL.md` (Step 1b), `skills/deployed-version-check/SKILL.md`.

> Source gap: lessons say Step 0 was folded in but not yet run on a live bug. Designed, not proven.

## Step 1: reproduce at the true failure boundary

**What.** Start every service the bug could touch. Make it break where the wrong thing really happens.

**Why.** A middle layer can hide the signal. A dev proxy once swallowed a client disconnect, so browser tests said "fine". Only a direct backend call with a hard connection kill triggered it.

**How.**

1. UI bug in the web app: write a flow (next section) and run it first. A `pass` verdict on the old build is your reproduction proof.
2. Per repo in the folder: read the README for the start command, never guess. Start through the `services` tool. Prove health. Report command, port, PID, log, proof.
3. Confirm real observable state. A clean exit is not proof. Poll the real database or downstream effect.
4. Does not break? Stop. Report exact requests, responses, environment. Next step is your call.
5. Breaks? Write `plan/repro.md`: `## Environment`, `## Steps`, `## Observed`, `## Expected`, `## Evidence`. Draft the steps as a comment in a fenced block. Post after approval. Never write the repro-steps field.

Auth blocks a live check? Invent no bypass. Read no secrets file. Try reusing a legitimate session first. Else state the blocker and use the strongest static proof.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Step 1), `rules/global/BUG_FIXING.md` (1, 2).

> Correction: the bundled Step 1 says "start as a detached background process". The rule wins: start only through `services`.

## Playwright flows

**What.** A **flow** is a file of steps a cheap vision model follows in a browser, returning a verdict. `flow-schema` is the format. `flow-runner` is the agent that runs it.

**Why.** A visual bug needs a repeatable check. Screenshots become PR evidence. It costs less than a human walkthrough.

**How.** One flow, three runs:

| Run | env | expect | Build | Why |
|---|---|---|---|---|
| 1 | local | broken | `main`, pre-fix | Reproduce. Proves the flow can see the bug. Never skip |
| 2 | local | fixed | fix branch | Verify |
| 3 | qa | fixed | QA deploy | Retest. Human logs in |

1. Load `flow-schema`. Gather all inputs: ticket and every image, vault task page, UI map note, web app source for every page touched. Source beats the map. No UI surface? Say so and stop.
2. Write `docs/flow.yaml`: routes only, never a host; targets by `role` plus `name`, or `text`; one action per step; `discriminating: true` only where broken and fixed differ; `check: screenshot` for layout, overlap, icons, visibility; no `validated` block (the runner writes it).
3. Run 1: check out the pre-fix commit. Start the web app through `services` with `repo_paths` on port 5173. **Prove the served build**: `lsof` the listener (its folder must be the pre-fix worktree) and `curl` one changed module (it must lack the fix).
4. Dispatch `flow-runner` with `flow_path`, `env`, `expect`, `base_url`, `sha`, `served_sha_verified: true`. Read `result.yaml` yourself. Check one screenshot against its citation.
5. Run 2: restart on the fix worktree, port 5173 (auto-login works only there). Run 3: `env: qa`; on `AUTH HANDOFF` ask the human to log in, then send `continue`.
6. Write one line per run under `## Flow runs` on the vault task page. Tear down.

The runner refuses `expect: fixed` with no `validated` block, a host in a step, or an unverified `base_url`. A returned bug writes `docs/flow-r<n>.yaml`. Playwright traps: `target` takes only a snapshot ref like `e24` or CSS; calls time out at 30 seconds; policy denies the evaluate, console, and network tools.

**Where in pack.** `skills/flow-schema/SKILL.md`, `agents/flow-runner.md`, `skills/e2e-verification/SKILL.md`.

> Source gap: lessons say local auto-login with the runner end to end was not run. Expect to debug it once.

## Using the debugger

**What.** Step 2b. After it breaks, pause the program at the suspect spot and read real values.

**Why.** Prints guess. A debugger shows the exact frame, type, and value. They go straight into the root-cause doc.

**How.**

1. Restart only the suspect service in debug mode: `services`, `action: restart`, `debug: [<id>]`. Leave the rest normal.
2. Attach, in this order: `debug launch` with the named adapter; for a service the `services` tool started in debug mode, a raw DAP socket client in the eval Python kernel (the built-in attach timed out on a clean listener); `debug attach` only for a service started some other way.
3. Set breakpoints. Re-fire the exact reproduction request. Read `stack_trace`, `variables`, `evaluate`.
4. Never probe the debug port with a connect. `debugpy` allows one client and a probe burns the slot. Check passively: `lsof -nP -iTCP:<debug_port> -sTCP:LISTEN`.
5. What changed lately? `git -C <repo> log --since="30 days ago" --oneline -- <files>` and `git -C <repo> blame -L <n>,<n> <file>`. Record commit, PR id, date. Fix in light of that change, not around it.
6. Detach and restart in normal mode: a service paused on a breakpoint fails health checks and looks like a second bug. Skip debugging only when request and response alone prove the cause; say so.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Step 2b), `skills/service-startup-reference/SKILL.md`, `harness/project/dap.json`, `agents/error-detective.md`.

> Rock rule: `debug launch` first. Raw DAP client for a `services`-started debug service. `debug attach` only for a service started another way. The bug skill and the service reference both say this.

## The root cause doc

**What.** The root-cause section at the top of each `plan/fix-plan-<repo>.md`.

**Why.** A fresh session reads it and knows the cause without your chat.

**How.** Write: what you saw at the breakpoint (values, types, frame); the real `file:line` where it goes wrong; the recent change, with commit, PR id, date; the trigger request or click; what you did not prove, marked plainly.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Steps 2b, 3).

## Fix design per repo

**What.** Step 3. One short design doc per affected repo, plus a shared doc when two or more repos change.

**Why.** A design can be right once both sides ship and still break in the middle. Find that before shipping.

**How.**

1. `plan/fix-plan-<repo>.md` with exact files and lines.
2. Two or more repos: `plan/FIX-PLAN.md`. It links each doc and checks that each repo's design matches the other's chosen design, in plain words.
3. List every deploy order (A first, B first, together) and what the user sees at each step.
4. Spot-check a few citations against current source. Source drifts.
5. Smallest change. List every file. A file outside the list needs a one-line reason first.
6. Failing test first. Name the test file and function, write it, run it, record the failure under `## Failing test`. Then the fix. Place the test by the table in the proof part.
7. Delegating? One worker per repo, in parallel, each with a full brief: exact files, what is out of scope, exact test names and commands, and "report a blocker, do not invent a result". Then read the real diff and output. A worker's "done" is a claim.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Step 3), `rules/global/BUG_FIXING.md` (3, 4, 6).

## Live verification against the real dependency

**What.** Step 4. Prove the fix with real parts, not only unit tests.

**Why.** A unit test checks your code against your model of a dependency, not the model. A mock once said "the call rejects on abort". The real library resolves. All tests green, fix did nothing.

**How.**

1. Dev proxy in the way? Test the backend port directly.
2. A local UI check logs in by itself. Never ask the human to log in locally. QA needs the human.
3. A fix that depends on library, framework, or proxy behaviour needs one live test against the real thing.
4. Run the repo's PR-build checks. Live checks add to them, never replace them.
5. Run the mutation check and place the regression test (next part). UI bug with a flow: run 2, `expect: fixed`. Then tear down: close Playwright, stop what you started.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Step 4), `skills/e2e-verification/SKILL.md`, `rules/global/BUG_FIXING.md` (5).

## Commit rules

**What.** Step 5. How code leaves your folder.

**Why.** Small clean commits make review quick and amends safe.

**How.**

1. **One commit per repo**, code and tests together.
2. A late finding? `git commit --amend`, never a second commit. Force-push your own branch only, as `--force-with-lease=<branch>:<sha>`. Never plain `--force`. Confirm a push with `git ls-remote origin refs/heads/<branch>`, not the exit code.
3. Write the message to a file in the ticket folder, then `git commit -F <file>`. A heredoc inside `-m` gets mangled.
4. Before any push: `./secret-scan.sh <task>/<repo> <base>` from the tasks root. Push only on `RESULT: clean`. Exit 2 means scanner missing or base wrong: fix it, do not push.
5. `./self-review.sh <task>/<repo>` writes `review/self-<repo>.diff` and prints five sections: files changed, new code comments, env and secret files, dependency changes, secrets in content. Every file must be in the fix plan. Fix until `RESULT: clean`.
6. Run `pr-security-gate`. Result in `review/SECURITY-GATE.md`.
7. Open the PR without asking when all hold: it reproduced; new test failed before and passes after; mutation check passed; PR-build checks pass; live check passed; self-review clean; security gate passed (clean, deferred findings only, or the draft path). One failure, no PR.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Step 5), `scripts/self-review.sh`, `scripts/secret-scan.sh`, `skills/pr-security-gate/SKILL.md`, `agents/pr-security.md`, `skills/pr-creation/SKILL.md`.

## State moves and the team message

**What.** Tracker state follows facts. Slack gets one fixed line.

**Why.** Each move waits for a checkable fact, so nobody has to ask.

**How.** The Bug ladder:

| Move | Who | Trigger |
|---|---|---|
| `New` to `Ready for Triage` | agent | bootstrap, only from `New` |
| `Ready for Triage` to `Ready for Fix` | agent | the bug reproduced |
| hold `Ready for Fix` | none | while the PR is open, in review, or revised |
| `Ready for Fix` to `Resolved` | agent | every linked PR merged (abandoned ones do not count) |
| `Resolved` to `Ready for Retest` | agent | `tasks-deployed-to-qa` proves the fix is on QA by ancestry check |
| `Ready for Retest` to `Closed` | tester only | human verified |

- One state per write. Re-fetch. Use the `/rev` test operation.
- A merge never moves the ticket, even with the auto-transition flag.
- Link each PR to the work item. Re-fetch relations and find an entry named `Pull Request`. Do not trust the link call.
- Never write `Closed`, `Pending PO Review`, `Accepted`.

Team message: right after the PR opens, post to `#<team-channel>` with no draft and no approval. One message per PR. Exactly one line: `PR <PRID> for review (<repo>): <summary> (Bug <N>)`, plus ` (re-fix)` for a returned bug. No @mentions. Draft PRs and pushes to open PRs get no post. Send with a `blocks` rich-text payload so the link renders, then re-read history. (The bundled bug command says it stops before Slack. The later rule wins.) After merge run `post-merge`: dev deploy check, evidence, tester handoff note.

**Where in pack.** `skills/bug-workflow/SKILL.md` (Steps 6 to 8), `skills/pr-and-team-comms/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md`.

> Ugh. Fall: A PR auto-merged in about 15 seconds, unreviewed, and moved the bug to `Resolved`. The reviewer was added as optional. The author reverted `main` by hand. Mark the reviewer required, re-fetch, and only then arm auto-complete.

# Building a Story

Cave elder says: a house is not a beast hunt. The chief gives a plan. You follow it. If the plan has a hole, you do not guess. You go ask the chief.

## Session B in one picture

**What.** The autonomous half of a story: contract gate to opened PR and released resources.

**Why.** All the talking happened in Session A.

**How.**

```
Step 0 contract gate        Step 5 verification gate
Step 1 bootstrap            Step 6 open PR (no prompt)
Step 2 plan per repo        Step 7 release resources
Step 3 one worker per repo  Step 8 test and acceptance states
Step 4 test + live check    Step 9 team line, decision record
```

`/story 12345` reads the state. `Backlog` or `In Refinement` goes to Session A. `Ready for Development` or later goes here. A `STORY-12345-*` folder already there means resume: move in, skip finished steps.

**Where in pack.** `skills/story-workflow/SKILL.md`, `commands/story.md`.

> Correction: the story command text says the Slack message waits for approval. The later rule says the PR-open line posts with no draft. Other Slack posts still need a draft.

## Contract gate, then bootstrap

**What.** Step 0 gate (see the triage part). Step 1 bootstrap on branch `feat/<slug>`.

**Why.** A story that fails the gate must leave no mess.

**How.** Fetch the ticket and comments. Run the gate. Fail = comment, `In Refinement`, stop. Pass = the contract is the spec; do not reinterpret it. Run `ticket-bootstrap`. Do not set state; it should already be `Ready for Development`.

**Where in pack.** `skills/story-workflow/SKILL.md` (Steps 0, 1).

## Plan per repo

**What.** Step 2. Move to `In Development`. Write plan docs.

**Why.** Plans are memory. They also check the contract against real code before you write any.

**How.**

1. `Ready for Development` to `In Development`. Re-fetch.
2. Per repo: `plan/story-plan-<repo>.md` with real `file:line`.
3. Two or more repos: `plan/STORY-PLAN.md`. Link each doc, cross-check designs, restate the contract's deploy-order notes against the real design.
4. Map every AC to the plan and to its verification. An AC that maps to nothing is a gap, and goes to the escalation rule.

**Escalation rule, to the end.** Stop when: a contract stop condition hits; the code contradicts a contract item; the work needs an unnamed repo or touches a non-goal; an AC maps to nothing or its verification cannot run. Then: comment with `file:line` evidence, tag the right person, move to `Blocked`, stop. Never reinterpret the contract. Never widen scope in silence.

**Where in pack.** `skills/story-workflow/SKILL.md` (Step 2).

## One worker per repo

**What.** Step 3. One helper agent per repo, in parallel.

**Why.** Repos are separate. Helpers share no memory, only their brief.

**How.**

1. Re-check plan citations against live source.
2. Each brief holds: absolute task-folder paths; exact file list; out-of-scope list; exact test names; the exact verification command from the contract; "report a blocker, do not invent a result".
3. Read the real diff, test file, and output. Never forward "done, tests pass".
4. Start services from the main agent only. A subagent's services die with it. Parallel live runs cross-wire ports, so serialise live verification.

**Where in pack.** `skills/story-workflow/SKILL.md` (Step 3), `rules/global/BUG_FIXING.md` (6).

## Test, with a live check

**What.** Step 4. Run each repo's real checks, then the live checks the contract names.

**Why.** A passing mock is not proof.

**How.**

1. Run the PR-build checks from the service reference table. Those are the commands the pipeline runs.
2. `integration`-marked tests in the two MCP repos are not in the PR build. Run them once against real dependencies.
3. Test first for every behaviour AC: write, run, record the failure under `## Failing tests` in the plan, then implement.
4. Place each test by the placement table. A change to what the assistant says or does gets a catalogue case, proven on the local orchestrator.
5. A live web-app check uses the Playwright browser on port 5173 and logs in by itself.
6. Every AC whose contract verification names a live check gets that check run for real. Report the real result.

**Where in pack.** `skills/story-workflow/SKILL.md` (Step 4), `skills/regression-test-placement/SKILL.md`, `skills/service-startup-reference/SKILL.md`.

## The verification gate

**What.** Step 5. Eight checks, all must pass before any PR. It replaces an approval prompt.

**Why.** The author said: do not ask me when all is in order. The gate is the proof it is in order. Long, named, checkable.

**How.** One commit per repo first. Each item needs command output read in this session:

1. **Build.** Web app typecheck and build. Python: `uv sync` works, service imports or starts.
2. **Tests and lint.** Every PR-build command, plus integration tests once.
3. **Runs.** Each changed service starts through `services` and answers a real request on the changed path.
4. **Does what the task says.** Every AC's contract verification run, result recorded.
5. **Conforms to the plan.** Diff `main...HEAD`. Every planned change exists. No unplanned file.
6. **Mutation check** for every new unit test, in `plan/VERIFICATION.md`.
7. **Self-review.** `RESULT: clean`, every file in the plan, dependency changes named in the PR.
8. **Security gate.** `review/SECURITY-GATE.md`.

Write an AC to evidence table in `plan/VERIFICATION.md`. A failed item that the contract cannot fix means escalate. Never open a PR on a red gate. An early branch push for CI feedback is fine after a clean secret scan.

**Where in pack.** `skills/story-workflow/SKILL.md` (Step 5), `scripts/self-review.sh`, `skills/pr-security-gate/SKILL.md`.

## Open the PR, release resources

**What.** Steps 6 and 7.

**Why.** The PR is the product. Then you clean the cave.

**How.**

1. One PR per repo, no prompt. Follow `pr-creation`: conventional-commit title like `feat(scope): description (STORY-NNNNNN)`, the story template, an `## Evidence` section with before and after images from the flow run folder for every visual change.
2. Do not arm auto-complete.
3. Paste each PR URL in the final report.
4. Security gate's third round still has an introduced finding? Open with `isDraft: true`, skip the Slack line, name the finding. State stays `In Development`.
5. Release everything right after the PRs open, before the Slack line: close Playwright if you opened it; `services` `action: stop` and read `port_free` and `debug_port_free`; `docker compose down` (no `-v`) for each compose project you started; confirm with `lsof -nP -iTCP:<port> -sTCP:LISTEN` and `docker ps`. Never stop what you did not start.

**Where in pack.** `skills/story-workflow/SKILL.md` (Steps 6, 7), `skills/pr-creation/SKILL.md`, `rules/project/teardown-verification-tooling-after-pr.md`.

## The state ladder for a Story

**What.** Step 8 and the rungs around it.

**Why.** Same idea as bugs. Fact, then move. Humans keep the end.

**How.**

| Move | Who | Trigger |
|---|---|---|
| `Backlog` to `In Refinement` | agent | refinement or triage starts |
| `In Refinement` to `Ready for Development` | agent, after you approve | end of Session A |
| `Ready for Development` to `In Development` | agent | Session B Step 2 |
| any to `Blocked` | agent | escalation stop |
| back to `In Refinement` | agent | gate failure |
| `In Development` to `Ready for Test` | agent | every story PR merged |
| `Ready for Test` to `In Test` | agent | `tasks-deployed-to-qa` proves QA deploy |
| `In Test` to `Pending PO Review` to `Accepted` | tester, then product owner | never the agent |

- One neighbouring state per write. A bigger jump returns HTTP 400, though the type metadata says all-to-all.
- An AC fails after merge? The contract or plan missed something. Comment with evidence, use the escalation rule.
- Step 9: the PR-open line, and one decision page per repo with code change, with tradeoffs from the resolved questions.

**Where in pack.** `skills/story-workflow/SKILL.md` (Steps 8, 9), `skills/tasks-deployed-to-qa/SKILL.md`, `harness/project/AGENTS.md`.

> Rock rule: The agent writes up to "ready". Tester and product owner write the end.

# Proof: Tests and Verification

Cave elder says: "I killed the beast" is not proof. Show the tooth. Show the track. Show it twice.

Words, once:

- **Regression test** = a test that fails if an old bug returns.
- **Fail-first** = watch the test fail before you write the fix.
- **Mutation check** = remove the fix, keep the test. If the test still passes, it guards nothing.
- **Catalogue** = a JSON list of prompts and expected assistant behaviours, run on a schedule.

## Where does the test go

**What.** A lookup table. The kind of thing that broke decides the place.

**Why.** "Add a regression test" became a lookup, not a guess. Cheap tests run every PR. Costly live ones run at night.

**How.** Use `regression-test-placement`:

| What broke | Test goes in | Runs |
|---|---|---|
| A function, parser, tool | the repo's `tests/` | every PR |
| A field the API sends | e2e contracts file in `orchestrator` | every PR, mock mode |
| What the assistant says or does | prompt-regression catalogue (JSON) in `orchestrator` | nightly on dev; PRs check JSON shape only |
| A deck, Word file, or image | media test in `orchestrator` e2e | nightly on dev, live only |
| A screen or button in `web-app` | `*.test.tsx` by the component | every PR |
| A journey in `web-app` | `browser/*.spec.ts` (Playwright) | no pipeline today. Say so in the PR |

A catalogue case needs an `id` like `regression.<area>.<slug>`, `source: regression`, a `prompt`, a `guards` line naming PR and ticket, `expect` keys (such as `completes`, `tools_none`, `min_chars`), and a generous `max_seconds`. Bump the count assertions in the catalogue rules test. The test is the truth; the README may lag.

Prove the case on the local fix, not on dev. Dev runs `main`, so the case fails there until the fix deploys; `post-merge` runs it after the dev deploy. Never edit a case to make it pass, lower a count, or delete a case without a ticket.

**Where in pack.** `skills/regression-test-placement/SKILL.md`, `skills/post-merge/SKILL.md`.

## Fail-first and the mutation check

**What.** Two habits. The test fails before the fix. The test fails again when the fix is taken away.

**Why.** A test that never failed might never fail. A test that passes without the fix guards nothing.

**How.**

1. Write the test. Run it alone. It must fail. Record it under `## Failing test` (bug) or `## Failing tests` (story).
2. Write the smallest fix. The test must pass.
3. Mutation check: remove the implementation, keep the test, run the one test (must fail), restore, run again (must pass). Record both outputs under `## Mutation check` (bug) or in `plan/VERIFICATION.md` (story).
4. Pick the form by `git -C <repo> diff --quiet HEAD -- <files>`, which exits 1 for an uncommitted fix.
   - Uncommitted: `git stash push -- <files>`, test fails, `git stash pop`, test passes.
   - Committed (after commit, amend, or a returned bug): `git checkout origin/main -- <files>`, test fails, `git checkout HEAD -- <files>`, test passes, `git status --short` shows nothing.
   - Never stash a committed fix. It saves nothing, and `stash pop` restores an unrelated stash.
5. Single-test commands: Python `uv run pytest <file>::<test> --no-cov -q`; web unit `pnpm exec vitest run <file> -t "<name>"`; web browser `pnpm exec playwright test <spec> -g "<title>"`.

**What is in the skills:** fail-first, the mutation check with both forms, where to record them, and their use in the gates (paths below).

**What is a gap, from lessons:**

- The mutation check has two forms. Stash is for an uncommitted fix. Checkout from `origin/main` is for a committed fix, because stash saves nothing on a committed fix. Pick by `git diff --quiet HEAD -- <files>`. Both workflows point at the placement skill.
- Model behaviour is probabilistic. Lessons record a rule: the baseline on `main` must show the bad behaviour at least once in 15 runs, else stop; repeat runs per prompt; reset memory again after background jobs settle; add control prompts that must still call the tool; add a catalogue rule like `tools_never`. The bundled placement skill does **not** hold this text. Add it when you work on assistant behaviour.
- Mutation check, returned-bug Step 0, and self-review were folded in and not yet run on a live bug. Treat as designed, then tune.
- The global `tdd` skill was referenced by no project skill, and the pack does not bundle it. Fail-first lives in the workflow skills.

**Where in pack.** Fail-first: `skills/bug-workflow/SKILL.md` (Step 3), `skills/story-workflow/SKILL.md` (Step 4). Mutation check and both forms: `skills/regression-test-placement/SKILL.md`. Gate use: story gate item 6, and a bug PR condition.

> Rock rule: A test that passes without the fix is not a test.

## E2E, and why a passing mock is not proof

**What.** Live verification through real services, storage, and model gateway, using `e2e-verification`.

**Why.** A mock holds your guess. A real call tests it. A mock once said "the call rejects on abort". The real library resolves. All tests were green and the fix did nothing. A verification on a stubbed API was thrown out by the author: test the real app. One live run of a probabilistic behaviour looked like proof, but a background job had undone the memory reset. Report each check as ran live, ran mock, or not run.

**How.**

1. Start services through `services`. Prove health and no cross-wiring.
2. Auth by service. The orchestrator has a local-dev bypass (needs `ENV=local`); read the fake token through the app's own config loader, never `cat .env`. The file gateway has no bypass and needs a real token. The web app uses real sign-in: local runs log in as a test user, QA needs the human.
3. Local browser login: navigate, click the continue button, type the key name for username and password (the MCP swaps in the real value), run the TOTP helper for the code, click Verify. Failure: report `auto-login failed: <code or step>`. Never ask the human to log in locally, type a literal credential, or read the secrets file.

**Where in pack.** `skills/e2e-verification/SKILL.md`, `automation/playwright/totp.mjs`, `rules/global/BUG_FIXING.md` (5), `skills/service-startup-reference/SKILL.md` (Dev-only features).

> Rock rule: Mock passing is not proof. Real call at least once. Say what was real and what was not.

## Screenshots and evidence

**What.** Proof a reviewer can open.

**Why.** The reviewer has no context. A PR that says "tested" is a claim.

**How.**

1. Flow runs write screenshots and `result.yaml` to `docs/flow-runs/<date>-<env>-<expect>/`. Read `result.yaml` yourself. Check one screenshot against its citation.
2. Visual change: PR `## Evidence` holds a before and an after image from that folder.
3. After merge, `post-merge` writes dev evidence and a click path for the tester. Move to `Ready for Retest` or `In Test` only after the QA deploy check passes.
4. Keep these out of PR text: "Fixes N" lines, "suite passing" counts, "live-verified" claims. Evidence goes in artefacts.
5. Never put a secret in evidence. Key names only.

**Where in pack.** `skills/flow-schema/SKILL.md`, `agents/flow-runner.md`, `skills/pr-creation/SKILL.md`, `skills/post-merge/SKILL.md`, `skills/tasks-deployed-to-qa/SKILL.md`.

> Rock rule: Evidence a stranger can open. Not "trust me".

# Running Things Locally

Cave elder says: fire is useful and dangerous. Light your own fire. Put it out when done. Never stamp on another tribe's fire.

Words, once:

- **Service** = a program in the background that answers requests. **Port** = a numbered door on your machine, one program per door.
- **PID** = the number of a running process.

## Why there is a reference and a tool

**What.** `service-startup-reference` explains the facts. The `services` tool does the work.

**Why.** Ports are hard-coded across repos and tasks run in parallel. People once started services by hand and killed each other's. One owner now holds the details: the tool. Docs point at it. A copied port table goes stale the day a default changes.

**How.**

1. Read the reference before a first start. Then do everything through the tool. The tool code is the authority for ports and start commands.
2. A direct `hub` start or a named bash start needs the human's explicit yes. Do not send a subagent to start a service.

**Where in pack.** `skills/service-startup-reference/SKILL.md`, `harness/extensions/project/services/index.ts`, `harness/extensions/project/services/plan.ts`, `rules/project/services-via-services-tool.md`.

## The services tool and its ports

**What.** Five services.

**Why.** You need to know each door.

**How.**

| Service id | What it is | Port | Debug port |
|---|---|---|---|
| `file-gateway` | proxy to blob storage | 9000 | 5681 |
| `media-mcp` | makes images, decks, Word files | 8001 | 5680 |
| `data-mcp` | wraps public data APIs | 8002 | 5679 |
| `orchestrator` | backend API that runs the LLM agent | 8000 | 5678 |
| `web-app` | React and Vite frontend | 5173 | none |

`infra` has no local start. `legacy-agent` is excluded.

Parameters: `action` (`start`, `stop`, `restart`, `status`, `logs`); `services` (list or `"all"`); `task_dir`; `repo_paths` (a worktree per service); `debug`; `ports` and `debug_ports` (strict); `env`; `lines`, `grep`.

```json
{"action":"start","services":"all","task_dir":"<TASK>"}
{"action":"restart","services":["media-mcp"],"debug":["media-mcp"]}
{"action":"stop"}
```

Facts:

- Local mode needs `ENV=local` for the orchestrator fake-auth bypass.
- Orchestrator settings classes use different env prefixes: check each class. Sibling wiring is `AGENT_MCP_<SERVICE>_URL=http://localhost:<port>/mcp`.

**Where in pack.** `skills/service-startup-reference/SKILL.md`.

## Start order

**What.** Who starts first.

**Why.** Some services need others alive.

**How.**

```
file-gateway --+
media-mcp -----+--> orchestrator ----> web-app
data-mcp ------+    (needs a DB)       (also needs file-gateway)
```

1. The first three have no dependency on each other. Start them together.
2. `orchestrator` next. Every start runs a local database container through compose. A Docker failure returns `docker_unavailable`: start the Docker VM yourself, ask before restarting it.
3. `web-app` last. The orchestrator loads MCP tools once at startup, so restart it if an MCP server came up late.
4. Errors carry codes such as `port_in_use` and `health_failed`. After `health_failed` the process stays up so you can look. Stop it with `action: stop`.

**Where in pack.** `skills/service-startup-reference/SKILL.md` (Dependency graph and start order).

## Port policy and the ownership rule

**What.** The law about other people's fire.

**Why.** A lifecycle agent once killed a process another task owned. One worker's `kill -9` took down a healthy sibling. Prose did not hold, so code now enforces it.

**How.**

1. A process on a port belongs to another session until proven otherwise.
2. Before every start: `lsof -nP -iTCP:<port> -sTCP:LISTEN` (`lsof` lists who holds a port), then `lsof -a -p <pid> -d cwd` and `ps -p <pid> -o pid,etime,command`. A folder that is not your worktree, or an age of minutes right after you "just started it", means it is not yours.
3. Never stop, kill, or restart it. Not even with the human's live authorization. Pick another port and rewire callers, or ask the human to talk to the owner.
4. Tool policy: try the canonical port; if a foreign process holds it, take the next free port and rewire siblings. An explicit port is strict: a busy one fails with `port_in_use` and the owner's PID, folder, command. `web-app` is always strict.
5. `harness/extensions/project/process-ownership-guard.ts` enforces this. It keeps an ownership ledger. It blocks `pkill`, `killall`, `xargs kill`, and any `kill` with no literal PID. A block reason starting `process-ownership-guard:` is final. Report it. Only the human stops a foreign orphan, in their own terminal.

**Where in pack.** `skills/service-startup-reference/SKILL.md` (Absolute rule), `harness/extensions/project/process-ownership-guard.ts`.

> Ugh. Fall: "Never stop a foreign process" was prose. An agent killed another task's process. Later bypasses used `kill $(lsof -ti :PORT)`. Now a code guard.

> Rock rule: Never kill what you did not start. Not even if told it is fine.

## Green but wrong: cross-wiring

**What.** Every health check green, yet the stack talks to the wrong branch.

**Why.** Sibling URLs are hard-coded in each repo's `.env`. A service that fell back to another port still passes its own check. Callers keep hitting whatever sits on the canonical port.

**How.** When more than one task's stack may run:

1. Work out expected sibling URLs from proxy config source or a startup log line. Not from `.env`.
2. `lsof` each port. The PID's folder must be your worktree. A fallback port means the caller needs the new URL; fix it from your side only.
3. After every start, re-check health fresh. Never use a cached report.
4. A chain across more than two repos? Spawn `error-detective`.

**Where in pack.** `skills/service-startup-reference/SKILL.md` (Cross-wiring detection), `agents/error-detective.md`.

## Teardown after use

**What.** Stop everything you started, same turn.

**Why.** A Playwright browser and dev servers once stayed running after the PR. Orphan helpers hogged ports and confused the next session.

**How.**

1. Plan the stop before you start.
2. Stop through the tool that started it: `services` `action: stop`.
3. After each stop: `lsof -nP -iTCP:<port> -sTCP:LISTEN`. Report the literal result. Check child, reloader, and helper PIDs. The tool reports `port_free` and `debug_port_free`. Close the browser and `docker compose down` (no `-v`) for compose projects you started.
4. Final report: each process stopped, each port free. If not, say which and why.
5. The guard blocks a stop of something you started? Report at once and ask the human. Never use another route.

**Where in pack.** `rules/project/no-orphan-processes-after-use.md`, `rules/project/teardown-verification-tooling-after-pr.md`, `skills/bug-workflow/SKILL.md` (Step 4), `skills/story-workflow/SKILL.md` (Step 7).

> Rock rule: Light it, use it, put it out. Same turn.

## Debug attach

**What.** Attach a debugger to a running service.

**Why.** Bug Step 2b needs it.

**How.**

1. Restart only the suspect service in debug mode via the tool. It runs `debugpy` with `--wait-for-client`. The debug port stays closed until a client attaches. That is normal.
2. Never use `--reload` under a debugger. Never probe the debug port with a connect: check passively with `lsof -nP -iTCP:<debug_port> -sTCP:LISTEN`.
3. Only `media-mcp` declares `debugpy`. The tool runs the other three with `uv run --with debugpy`.
4. Own the launch? `debug launch` with the named adapter. Tool-started service? The raw DAP socket client from the reference. Match every response by `request_seq`. Keep the socket open.
5. After a debug stop a helper may keep the port. The tool's stop reports `debug_port_free`. By hand, kill only a literal PID whose `ppid` is 1 and whose command is `debugpy/adapter --for-server ... --port <debug_port>` for the same repo.
6. The web app has no process debugger. Use a browser debugger. The dev server binds the IPv6 loopback: probe with the `localhost` hostname.

**Where in pack.** `skills/service-startup-reference/SKILL.md` (debug sections), `harness/project/dap.json`.

> Rock rule: Do not touch the debug door. Look from far away.

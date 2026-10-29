---
name: ticket-bootstrap
description: Use when given an ADO ticket number for the platform's project and asked to start work on it, OR when a ticketless finding/research item needs a task folder with linked repos — covers fetching the ticket, running setup-task-branch.sh (which creates the {TYPE}-{NUM}-{summary} task folder, ticketless items use RESEARCH-00000-{summary}, checks for an existing folder for the same ticket, and wires worktrees/symlinks across every *-bare repo) under ~/work/<PROJECT>/tasks, excluding deprecated repos, and setting the initial ADO status. Bugs load this first; User Stories reach it via story-workflow Step 1, after story-refinement wrote the Agent Contract. Hands off to bug-workflow or story-workflow.
---

## Input

- `ticket_number` (e.g. `12345`) — the only input the invoker supplies.
- The ticket type (`Bug`, `User Story`) is NOT a separate input. Discover it by
  fetching the ticket.

**Ticketless variant** — a finding to research or a vault follow-up with no
ADO ticket ("create a folder with linked repos and test X") uses this same
skill. The placeholder ticket number is `00000`, and the type is `RESEARCH`,
so the folder keeps the standard shape: `RESEARCH-00000-<brief-summary>`
(e.g. `RESEARCH-00000-file-gateway-owner-check`). Branch:
`research/<brief-summary>`. Skip Step 1 and Step 5. Everything else —
especially Step 3's script — is identical. Never improvise the
folder/worktree/`.env` wiring by hand. If the research later gets a real
ticket, bootstrap it fresh under the real number; do not rename in place.


## Step 1 — Fetch the ticket

Look it up in Azure DevOps (MCP tools). If the MCP call fails, run the Azure CLI login command
from the `azure-cli-fallback` rule, then retry the MCP call. Never replace
the MCP call with `az boards work-item show`. Capture: work item type, title,
full description, repro steps or acceptance criteria, state, area path,
iteration path, tags, linked PRs, linked work items, comments, and the full
state history (fetched in Step 1b).

**Director mode (no direct bash/MCP access):** spawn a `fast` worker with ADO
MCP tools to do the fetch. This becomes the input for every later step.

## Step 1b — Detect a returned bug

A tester can move a bug back after a fix. Bootstrap must see this, read why
the bug came back, and keep the tester's state. Run this step for every Bug.

Add to the Step 1 capture list: the full state history. Fetch it with
`wit_work_item` action `list_revisions`, `workItemId: <N>`,
`project: "<ADO_PROJECT>"`. Page with `top: 200` and `skip` until a page
returns fewer than 200 items. Each revision carries `System.State`,
`System.ChangedBy`, `System.ChangedDate`, `System.Reason` and
`Microsoft.VSTS.TCM.ReproSteps`. Also fetch the relations with
`wit_work_item` action `get`, `expand: "Relations"`. If `skip` does not page
as expected, fetch with `top` large enough to cover `System.Rev` from the
`get` call.

Fixed terms:

- **POST set**: `Resolved`, `Ready for Retest`, `Closed`.
- **RETURN set**: `New`, `Ready for Triage`, `Ready for Fix`,
  `Bug Test Failed`, `Reopen`, `Blocked`.
- **STOP set**: `Cancelled`, `Duplicate`, `Deffered` (the ADO spelling).
- **Returned bug**: some revision has a state in the POST set, and the
  current state is in the RETURN set.
- **Move-back revision**: the latest revision `r` where the state of `r-1` is
  in the POST set and the state of `r` is not.
- **Window start**: the `System.ChangedDate` of the first revision of the
  continuous POST-set run that ends at `r-1`. The window runs from there
  until now.
- **Round `n`**: 1 + the number of POST-to-non-POST moves in the full
  history. The first return is `r2`.
- **Slug**: the `sourceRefName` of the latest linked PR, minus
  `refs/heads/fix/`, minus a trailing `-r<digits>`, and then minus a
  trailing `-<N>`. With no linked PR: the slug of the branch of the
  existing task folder in `tasks/` (`readlink` of any repo symlink in the
  folder), stripped the same way. An archived folder has no repo symlink,
  so use its summary slug (the folder name minus `BUG-<N>-`) instead. If no
  folder exists either: the normal Step 3 slug.
- **Return branch**: `fix/<slug>-<N>-r<n>`. The bug number `<N>` keeps the
  branch unique, because one PR can link several bugs and they then share a
  slug (PR 4567 links eight bugs). Without `<N>`, two returned bugs would
  get the same branch, and `setup-task-branch.sh` would reuse it without an
  error.
- **PR mode**, from linked PRs whose status is not abandoned.
  `repo_pull_request` action `get` returns `status` as a number: `1` =
  active, `2` = abandoned, `3` = completed (`3` observed on PRs 4567 and
  4568).
  - at least one `active` and at least one `completed`: **mixed**. Stop and
    ask the user which branch to use.
  - at least one `active`, none `completed`: **open-PR mode**.
  - otherwise (completed only, or no PR): **merged mode**.

Outcomes:

- The history never reached the POST set: a fresh bug. Continue as today.
- The current state is in the POST set: not returned. Continue as today.
- The current state is in the STOP set and the history reached the POST set:
  stop. Report the state, who moved it, when, and every comment in the
  window. Run no script and write no state.
- Returned bug: compute the move-back revision, the window start, round `n`,
  the slug and the PR mode. For each linked PR, read the PR from the relation
  URL `vstfs:///Git/PullRequestId/{projectId}%2F{repoId}%2F{prId}` with
  `repo_pull_request` action `get` (`repositoryId: <repoId>`,
  `pullRequestId: <prId>`). Record status, `sourceRefName`, `closedDate` and
  `lastMergeCommit.commitId`. In mixed PR mode, stop and ask. State in the
  report that this is a returned bug, round `r<n>`.

## Step 2 — Branch on ticket type

- **Bug** → next is verification (does it actually reproduce?). Go to
  `bug-workflow` after this skill.
- **User Story** → this skill is invoked FROM `story-workflow` Step 1
  (the autonomous implementation session), AFTER `story-refinement` or
  `/triage` wrote the Agent Contract and the state reached `Ready for
  Development`. The contract sits in the description, or in the newest
  comment headed `## Agent Contract (Ready for Development)`, as
  `story-workflow` Step 0 defines. If the state is not `Ready for
  Development` or neither place holds a contract, stop and route to
  `story-refinement` instead — do not bootstrap an unrefined story.

## Step 3 — Set up branch + worktrees across every repo

From `~/work/<PROJECT>/tasks`:

    ./setup-task-branch.sh <branch_name> <target_dir>

- `branch_name`: Bug → `fix/<brief-summary-with-dashes>`; User Story →
  `feat/<brief-summary-with-dashes>` (matches the Conventional-Commits branch
  prefixes in `pr-creation` — use `feat/` unless the story is itself
  a chore/refactor, in which case use that type's prefix instead).
- Returned bug (Step 1b), merged mode: `branch_name` is the return branch
  `fix/<slug>-<N>-r<n>`. Look for the `BUG-<N>-*` folder in `tasks/` and in
  `tasks/archive/`. `target_dir` is the folder in `tasks/` when one exists.
  When only an archived folder exists (a cleanup archive holds `plan/` and
  `cleanup.tsv`, no repo symlinks), leave it in place. Use the same folder
  name, with no `archive/` prefix, as `target_dir`. The script creates it
  new in `tasks/`. Its duplicate-folder guard scans `tasks/` only, so the
  archive does not block it. Read the archived `plan/` files for the
  previous fix, and cite them in `## Why the previous fix failed`. When no
  folder exists in either place, use the normal Step 3 `target_dir`.
  Rerunning the script on a folder in `tasks/` with the new branch name
  repoints each repo symlink to the new
  worktree off the latest `main` (`setup-task-branch.sh` removes an existing
  symlink and relinks). The old branch and worktree stay. Open-PR mode:
  `branch_name` is the open PR's branch (`sourceRefName` minus
  `refs/heads/`). The script reuses that worktree when it exists.
- `target_dir`: `{TICKET_TYPE_UPPERCASE}-{TICKET_NUMBER}-{very-brief-summary-with-dashes}`
  (e.g. `BUG-12345-multiple-healthchecks-failing`). The summary slug is a
  short human paraphrase of the ticket title, dash-cased. **The script
  creates this folder itself** — never `mkdir` it yourself first, and never
  delegate a folder-creation step to a worker; that step no longer exists.
  The script also checks `~/work/<PROJECT>/tasks` for an existing
  `{TYPE}-{NUM}-*` folder under a different summary slug and refuses to
  create a duplicate. If it stops with that error, reuse the folder name it
  names — don't invent a second slug for the same ticket.
  

**Two different reference points** — don't conflate them: bare repos
(`<name>-bare`) are discovered in the **parent** of the invocation directory
(`~/work/<PROJECT>`, since the script runs from `~/work/<PROJECT>/tasks`); `target_dir`,
if relative, resolves against the **invocation cwd itself** (`~/work/<PROJECT>/tasks`).

**The script is the only supported way to create worktrees and wire `.env`.**
Never hand-roll `git worktree add` plus a manual `.env` symlink, even for a
single-repo investigation — run the script. Hand-rolling loses the
task-folder symlink convention and the standing exclusion list.

What the script does per `<name>-bare` repo: reads the default branch, creates
(or reuses) `<branch_name>` as a git worktree off it, symlinks the bare repo's
root `.env` into the new worktree with a relative link whose `../` depth
equals the number of `/` in the branch name (missing `.env` is a normal WARN,
not a failure — some repos, e.g. `infra`, don't need one), and symlinks the
worktree into `target_dir` under the plain repo name (no `-bare` suffix). The
`--pr` mode links no `.env`. Treat the linked `.env` as already correctly
configured for this repo — do not question or edit it here (see
`service-startup-reference`'s "Cross-wiring detection" section for when it
stops being correct).

Already-verified safety properties, don't regress them if you ever touch the
script: idempotent reruns (same branch name reuses the existing worktree, no
duplicate-branch errors); one repo failing doesn't stop the others, and the
script still exits non-zero overall with the failing repo named; refuses to
`worktree add` into a path that exists but isn't a registered worktree, or to
overwrite a `target_dir/<repo>` entry that exists and isn't already a symlink.

**Gotcha, hit while verifying this skill set (2026-08-13):** rerunning the
script against an existing task folder — e.g. to pick up a script change —
creates a branch+worktree in **every** `*-bare` repo it finds, including
repos never in that task's original scope, if that specific branch name
didn't already exist there. The script's own standing exclusion list
(currently `legacy-agent`) is skipped automatically before any git work runs.
Read each repo's own log line (`Creating branch...` vs
`already exists ... (reusing)`) to know which ones are new. Leave the new
symlinks, branches, and worktrees in place; Step 4 forbids removing them
unless the user says so in the current session.

**`.env` access:** a bash command touching a real `.env` path needs no
confirm. The `guardrails` extension allows dotenv reads with values masked as
`*****`, blocks writing the mask back, and prompts only to overwrite an
unmanaged dotenv file.

Verify the script's own report by reading `target_dir`'s listing yourself —
don't just trust an exit code or a worker's self-report.

## Step 3a — Pick up a colleague's existing work

Run this check on every task, right after Step 3. A colleague may have
started the same ticket already. The task folder is still created by the
workflow above; this step only adds their commits to it.

A returned bug (Step 1b) in merged mode skips this step, because the earlier
branch is already in `main`. Open-PR mode runs this step as written.

**The default mode of `setup-task-branch.sh` never fetches a task branch.**
It fetches the default branch only (see the script's per-repo loop) and
creates the local branch off that. So a colleague's pushed branch of the
same name is ignored, and you silently start from `main` with an empty
history. You must pull their work yourself.

### 1. Find the existing work

Check all three sources before you decide there is none:

- Linked pull requests and comments on the ticket (Step 1's fetch).
- `repo_pull_request` action `list` with `status: All` per in-scope repo,
  then match the ticket number or the summary in the PR title.
- `repo_branch` action `list` with `filterContains: <ticket_number>` per
  in-scope repo, for a pushed branch with no PR yet.

Record the exact remote branch name and the repo it lives in. The
colleague's branch name wins over the name Step 3 would pick.

### 2. Re-run Step 3 with their branch name

If Step 3 already ran under a different branch name, and every repo it
created is still empty, re-run the script with the colleague's exact branch
name. The folder name does not change. The rerun repoints each repo symlink
to the worktree of the colleague's branch. Leave the stale empty branches and
worktrees of the earlier run in place: Step 4 forbids removing them unless
the user says so in the current session. See `task-branch-script-internals`
for the script's own semantics.

### 3. Pull their commits, per repo

The script branches every in-scope repo, but a colleague usually pushed to
one or two. Decide per repo, never per task. From the task folder, test
each repo for the remote ref:

    git --git-dir=$HOME/work/<PROJECT>/<repo>-bare ls-remote --heads origin <branch>

Empty output means no colleague work in that repo. Leave it alone; it keeps
the fresh branch off the default branch. Only for a repo that prints a ref,
continue.

Next, prove the local branch holds nothing of yours:

    git -C <repo> log --oneline origin/<default_branch>..HEAD

That must print nothing. An empty result proves the local branch is the
fresh one the script just made, so nothing of yours is lost. If it prints
commits, stop and ask the user — the branch already holds local work.

Then fetch and align that one repo:

    git --git-dir=$HOME/work/<PROJECT>/<repo>-bare fetch origin \
      "+refs/heads/<branch>:refs/remotes/origin/<branch>"
    git -C <repo> reset --hard "origin/<branch>"
    git -C <repo> branch --set-upstream-to="origin/<branch>"

Record which repos you reset. Report that list to the user.

### 4. Verify each repo you reset

    git -C <repo> log --oneline -5
    git -C <repo> status -sb

The log must show the colleague's commits. `status -sb` must report the
branch in sync with `origin/<branch>`, with no divergence. Read that output
yourself; never accept a worker's self-report here.

### 5. Work on top, never over

- Add your own commits on top of theirs. Never rebase, amend, or
  force-push their commits.
- Pull before each push: `git -C <repo> pull --ff-only`. They may still be
  pushing.
- Before each push, `./secret-scan.sh <task>/<repo> origin/<branch>` (run
  from `~/work/<PROJECT>/tasks`) must print `RESULT: clean`. Only your commits on
  top are scanned.
- If a PR is already open for that branch, push to it. Do not open a second
  PR (`pr-creation` covers the rest). Before that push, run
  `pr-security-gate` with base `origin/<branch>`.
- Tell the user whose work you picked up, and say so in the PR description
  and the vault entry.

## Step 4 — Exclude deprecated repos

**Never remove symlinks or delete branches/worktrees after the setup script
runs.** Leave every repo symlinked in the task folder, even repos out of scope
for the ticket, and leave every branch and worktree a rerun created. They may
be needed for testing later. Only a user instruction in the current session
lifts this.

`legacy-agent` is a **standing exclusion**, being retired as of 2026-08 in
favor of `orchestrator`. The script itself skips it (see
`task-branch-script-internals`) — it never gets a worktree or a
`target_dir` symlink, so there is nothing to clean up here for it.

Any OTHER repo named explicitly as deprecated mid-workflow: add its name to
the script's `excluded_repos` array so later runs skip it (see
`task-branch-script-internals`). Do not remove a symlink, branch, or worktree
yourself unless the user says so in the current session. Never touch the
`-bare` source.

## Step 4b — Wire LSP and DAP

Run this after Step 4's exclusions are applied, so an excluded repo is never
installed:

    ./setup-task-lsp.sh <target_dir>

from `~/work/<PROJECT>/tasks`. It links the shared `.omp`, installs every repo in
the folder (`uv sync` per Python repo, `pnpm install` for `web-app`, plus
`debugpy` where a repo's own dependency group misses it), and writes
`lsp.json`, `dap.json`, `pyrightconfig.json` and `.task-root`. Expect a
few minutes on a cold folder. It is idempotent — re-run it after adding or
removing a repo symlink.

A returned bug in an existing folder (Step 1b) still reruns
`setup-task-lsp.sh`, because the new worktrees have no installs.

When it finishes, call the `move_session` tool with the `target_dir` (a direct
child of `~/work/<PROJECT>/tasks`) instead of surfacing `/move` and waiting. The
tool moves, with no prompt, only to the directory `omp` was launched in or a direct child of it, with no limit on the number of moves. Any other target, such as a repo inside a task folder, is refused. It does not
drop the Azure DevOps, Slack, or Playwright MCP servers already attached to
this session (live-verified 2026-09-17, see
`vault://wiki/decisions/2026-09-17-move-session-tool-extension.md`). `lsp` and
`debug` only see the generated config once the session cwd is the task
folder. A subagent's own `move_session` call is refused; only the top-level
session can move itself. Starting a fresh session with `cd <task_dir> && omp`
makes that task folder the root, so its repos become reachable. Start sessions
at `~/work/<PROJECT>/tasks` to keep repos out of reach.

- Always name the adapter explicitly for `debug` — for example
  `adapter: "debugpy-file-gateway"`. Every generated adapter carries no
  `fileTypes`, so auto-selection will never find one.
- Every target starts through `debug launch`. Nothing needs a shell command
  first, and no browser or server is started by hand.
- Python launch triple: `program` is always `<task_dir>/<repo>/.venv/bin/uvicorn`.
  Never add `--reload` — it forks a child the debugger can't see.

  These values mirror the agent defaults in `.omp/agents/`. The agent file is
  authoritative. When a service already runs on another port, use that port.

  | repo | `args` | debugpy port |
  | --- | --- | --- |
  | `orchestrator` | `["app.main:app", "--host", "0.0.0.0", "--port", "8000"]` | 5678 |
  | `data-mcp` | `["src.main:app", "--host", "0.0.0.0", "--port", "8002"]` | 5679 |
  | `media-mcp` | `["src.main:app", "--host", "0.0.0.0", "--port", "8001"]` | 5680 |
  | `file-gateway` | `["src.main:app", "--host", "0.0.0.0", "--port", "9000"]` | 5681 |

  Use `debug attach` with the same adapter only for a service already running
  another way, such as `docker compose`. For a service the `services` tool
  started in debug mode, attach with a raw DAP client on the debugpy port
  (`service-startup-reference`, section "Attaching a debugger").
- Debugging `web-app` in the browser is one call: `debug launch` with
  `adapter: "js-chrome-web-app"` and
  `program: "<task_dir>/web-app/index.html"`. The dev server must
  already serve `https://localhost:5173` (`pnpm run dev`). If it serves plain
  HTTP (`VITE_DEV_HTTPS=false`), use `adapter: "js-chrome-web-app-http"`
  instead. Set breakpoints on the task-folder path (`web-app/src/...`).
  A breakpoint set after the page's first navigation has already run past
  that line never fires on that navigation (a registration race, not a
  broken adapter). If a breakpoint does not pause on the first load, call
  `debug evaluate` with `location.reload()` in `repl` context to force a
  fresh navigation once the breakpoint reports `verified`; that reload does
  pause correctly.
- Debugging `web-app` unit tests uses `debug launch` with
  `adapter: "js-node-web-app"` and
  `program: "<task_dir>/web-app/node_modules/vitest/vitest.mjs"`. Set
  those breakpoints on the **resolved** worktree path
  (`readlink -f web-app`), not the task-folder symlink. Node reports
  module paths physically. Breakpoint binding on a single fast test file is
  unresolved and stays `pending`, not `verified`, across many attempts (a
  known, unresolved limitation of this adapter, not a config error, and
  distinct from the browser adapter's registration race above). No known
  workaround yet; if you need a real Node breakpoint hit, use a slower or
  longer-running test target and expect it to still be unreliable.
- `infra` gets no language server by design.

## Step 5 — Set the initial ADO status

- **Bug** → write `Ready for Triage` only when the current state is `New`
  (verification is about to happen). Any other current state stays as it is,
  including a returned bug (Step 1b), so the tester's state is never
  overwritten. `bug-workflow` drives the remaining transitions.
- **User Story** → do NOT set a state here. `story-refinement` (Session A)
  owns the Story states up to `Ready for Development`; by the time this skill
  runs the state is already `Ready for Development` — verify that, don't
  write. `story-workflow` drives the transitions from `In Development`
  onward.

Reads go through `wit_work_item`; state writes go through `wit_work_item_write`
(action `update` with `System.State`) — `wit_work_item` itself is read-only,
and a write attempt through it wastes a turn. After writing, re-fetch to
confirm the state stuck — don't trust the write call's own success response
alone.

If you're ever unsure of a project's exact state names, fetch the work item
type's states once (`wit_work_item` action `get_type`) and use the real list —
don't guess or assume a generic template.

## Next

Bug ticket → load `bug-workflow`. User Story ticket → return to
`story-workflow` Step 2 (this skill ran as its Step 1).

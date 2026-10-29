---
name: bug-workflow
description: Use for a platform Bug ticket once ticket-bootstrap has already created the task folder and branch/worktrees, and for a bug returned after a fix (state moved back out of Resolved, Ready for Retest or Closed) — covers reading why a bug came back, checking the QA build, starting services for verification, detecting cross-wired stacks with the error-detective agent, writing a fix design doc, live-verifying the fix, test first with a mutation check, regression placement, one-commit-per-repo, opening the PR, moving ADO state through the real Bug workflow, and recording the vault entry.
---

Prerequisite: run `ticket-bootstrap` first if you haven't — this skill
assumes the task folder, branch, and worktrees already exist and ADO state is
`Ready for Triage`, or bootstrap Step 1b flagged a returned bug. If the
`BUG-<NUM>-*` folder already exists, call
`move_session` with that folder name before any other step. A returned bug
runs Step 0 first.

## Step 0 — Returned bug: find why it came back

Skip this step for a bug that bootstrap Step 1b did not flag. Step 1b
defines the terms used here (POST set, move-back revision, window start,
round `n`, slug, PR mode). Write every result to `<task>/plan/return-r<n>.md`.
Use these sections, in this order: `## Move-back` (revision number, date,
who, from-state, to-state, `System.Reason`), `## Evidence` (each item quoted
verbatim, with source and date), `## Repro steps` (numbered), `## Linked PRs`
(id, repo, status, branch, merge commit), `## QA build check`,
`## Reproduction`, `## Outcome`.

1. **Collect evidence in the window.**
   - Ticket comments: `wit_work_item` action `list_comments`, `top: 200`.
     Keep comments whose `createdDate` is at or after the window start. The
     `text` field holds the comment as stored: plain text for some comments,
     HTML for others (observed on bug 12345, with `<img>` tags that carry
     the screenshot URLs). Strip the tags to read it. Quote the text as
     returned.
   - Repro Steps edits: compare `Microsoft.VSTS.TCM.ReproSteps` at the window
     start revision with the latest revision. Compare the raw text only when
     both revisions have the same `multilineFieldsFormat` for that field
     (bug 12346 changed from `html` to `markdown`). When the formats
     differ, strip the tags and markup from both, then compare the text.
     Record the new text when it differs.
   - Attachments: relations with `rel: "AttachedFile"` and a
     `resourceCreatedDate` attribute at or after the window start (the
     attribute is on the relation `attributes`; observed on bug 12345). Run
     `mkdir -p` first, then download each with `wit_work_item_attachment`
     into `<task>/docs/attachments/r<n>/` (absolute path).
   - Linked PR threads: `repo_pull_request_thread` action `list` per linked
     PR with `fullResponse: true`. The trimmed output has no `commentType`.
     Keep threads whose first comment has a `commentType` other than `3`
     (system: policy updates, votes; observed on PR 4567) and a
     `publishedDate` at or after the window start.
2. **Pick the repro steps.** Steps found in the evidence (numbered steps, a
   step list, or a recording in an attachment) win. Otherwise copy the
   original Repro Steps field and record "No repro steps given; using the
   original Repro Steps". In both cases, record the tester's stated reason as
   the observation that shows the bug.
3. **QA build check (merged mode only).** Open-PR mode records "n/a: PR not
   merged". Per repo with a completed PR:
   - Merge commit: `lastMergeCommit.commitId`. Confirm it is on `main`: run
     `git -C <repo> fetch origin +refs/heads/main:refs/remotes/origin/main`,
     then
     `git -C <repo> merge-base --is-ancestor <sha> origin/main`. If that
     fails, find the squash commit with
     `git -C <repo> log origin/main --format=%H -E --grep "(Merged PR|Merge pull request) <prId>( |:)"`
     (both message formats seen in the PR API `lastMergeCommit` comment: a
     manual completion reads "Merged PR 4567: <title>", an auto-complete
     reads "Merge pull request 4568 from <branch> into main". Confirm the
     git log message matches on the first run).
   - QA deployed ref: follow `deployed-version-check` for that repo,
     environment QA. Fetch the ref from the task-folder repo with an
     explicit refspec: `git -C <repo> fetch origin
     +refs/tags/<tag>:refs/tags/<tag>`, or for `web-app` the `qa`
     branch `+refs/heads/qa:refs/remotes/origin/qa`. Never run git in the
     `-bare` folders.
   - Run `git -C <repo> merge-base --is-ancestor <merge-sha> <deployed-ref>`.
     Exit 0 means QA holds the fix.
   - Any repo lacks the fix: stop. Record it. Show a draft ADO comment in a
     fenced block: the fix merged in PR `<url>` on `<date>`, QA runs `<ref>`
     without it, retest after the next QA deploy. Write no state. Post only
     after approval.
   - Deployed ref not found: record `unknown` and continue.
4. **Reproduce on QA first.** A bug with a `web-app` surface: write
   `docs/flow-r<n>.yaml` per `flow-schema`. Run `flow-runner` with
   `flow_path` set to that file, `env: qa`, `expect: broken`. The user logs
   in at the manual handoff. Other bugs: ask the user once to run the repro
   steps on QA and report the result. If the user declines, or QA is
   unreachable (for example `AADSTS53003` off VPN), record "QA: not run" with
   the reason and continue.
5. **Reproduce locally.** Run Step 1 on the task branch (merged mode:
   `fix/<slug>-<N>-r<n>`, which equals the latest `main` and holds the first fix;
   open-PR mode: the PR head). Use the Step 0 repro steps, not the original
   description. A UI bug runs `flow-runner` with `docs/flow-r<n>.yaml`,
   `env: local`, `expect: broken`.
6. **Decide from both results.**

   | QA | Local | Action |
   | --- | --- | --- |
   | reproduces | reproduces | Confirmed. Go to Step 2. |
   | reproduces | clean | Match QA locally, up to 3 attempts. Each attempt changes one variable that differs from QA: an `.env` flag, the test data, the user role, or the browser viewport. Record the variable, the value and the result. A reproduction confirms; go to Step 2. After 3 clean attempts, stop and report both results with evidence. Write no state. |
   | clean or not run | reproduces | Confirmed. Record the QA result. Go to Step 2. |
   | clean | clean | Stop. Show a draft ADO comment in a fenced block that asks the tester for the environment, the build, the user account and the exact steps. Write no state. Post only after approval. |
   | not run | clean | Same as clean/clean. |
7. **Vault record.** In every outcome, including a stop, add one line under
   `## Returns` on the vault task page (find it with
   `vault://wiki/?op=search&q=<N>`; create the heading when missing). Format:
   `- r<n> · <move-back date> · <from> -> <to> by <name> · reason: <one line> · QA build: has fix|missing|unknown|n/a · repro: QA yes|no|not run, local yes|no · outcome: re-fix|stopped (<why>)`.
   If no task page exists, skip the vault line and say so in the report.

## Step 1 — Start every non-excluded repo and verify the bug reproduces

For each repo symlinked into the task folder (see `service-startup-reference`
for exact per-repo start commands, ports, and dependency order):

**UI bugs in `web-app`:** load `flow-schema`, write
`docs/flow.yaml`, and run the `flow-runner` agent with `expect: broken` on
the pre-fix commit. A `pass` verdict is the reproduction evidence and
validates the flow. Run this before the manual repro below.

For a returned bug, Step 0 item 5 runs this step with the Step 0 repro steps.

1. Read the repo's `README.md` for the documented start command — don't guess
   or reuse a hardcoded command; repos differ.
2. Start it as a detached background process, output captured to a log.
3. Confirm it actually came up: clean log output and/or its health/root
   endpoint. Report start command, port, PID, log location, proof of health.
4. Pure-IaC repos (e.g. `infra`, Terraform-only, no local run
   step) get identified as such and explicitly skipped — never forced to
   "start."

If the ticket names a specific endpoint mismatch (e.g. "the health probe hits
`/` but the app only serves `/health`"), curl both paths and report both
status codes — that's the actual bug-verification evidence, not just "is it
up."

**Director mode:** spawn one `fast` worker per repo, in parallel, each told to
do the above. Verify their claims yourself: read the target folder's listing
for folder/symlink creation, require curl request+response evidence (not a
bare "status: running") for service startup, and require a re-fetch for any
ADO field write.

### Health checks alone are NOT sufficient — check for cross-wiring

If more than one task folder's stack (same repos, different branches) may be
running concurrently, per-service health checks passing does NOT prove the
stack is internally consistent. See `service-startup-reference`'s
"Cross-wiring detection" section for the port-ownership check, the cwd
verification, the fallback-port fix, and the `error-detective` delegation
for a full request-chain proof.

If the bug does not reproduce after this verification, stop and report the
exact evidence gathered (requests sent, responses received, environment
state) rather than guessing at a next step — that's a decision for the user,
not an assumption to make silently.

Once the bug reproduces, write the confirmed steps to `plan/repro.md`:
`## Environment` (local or QA, build, account), `## Steps` (numbered),
`## Observed`, `## Expected`, `## Evidence` (request and response, or the
flow-runner screenshot path). Then show the steps as a ticket comment draft in
a fenced block and post it after approval (RULES.md). Do not write the
`Microsoft.VSTS.TCM.ReproSteps` field.

## Step 2 — ADO state: move to `Ready for Fix`

Once reproduction is confirmed, move the ticket past triage:
`Ready for Triage → Ready for Fix`. Write via ADO MCP only, then re-fetch to
confirm it stuck. If the MCP write fails, run the Azure CLI login command
from the `azure-cli-fallback` rule, then retry the MCP write.

**Returned bug:** move from the current state to `Ready for Fix`. If the
state already is `Ready for Fix`, write nothing. Ask the user in chat before
the write, then re-fetch to confirm.

## Step 2b — Diagnose with the debugger, not print statements

Once the bug reproduces, trace the fault with the `debug` tool before writing
the fix design doc — breakpoints and real state beat log-guessing, and the
captured values feed straight into the design doc's file:line citations.

1. Restart only the suspect service in debugger-attachable mode (`services` `action: restart`, `debug: [<service id>]`; `debugpy`,
   ports 5678–5681 — see `service-startup-reference` for the per-service
   attach commands). Leave the rest of the stack running normally.
2. Attach with a raw DAP client on the service's debugpy port, as
   `service-startup-reference`, section "Attaching a debugger", describes
   (the `debug` tool's `attach` times out against a service the `services`
   tool started in debug mode). A service you start yourself with
   `debug launch` and a named adapter needs no attach. Set breakpoints on the
   suspect path, re-fire the exact reproduction request, and inspect real
   variables/stack: `stackTrace`, `scopes`, `variables`.
3. Record what you saw at the breakpoint (values, types, the exact frame) —
   that evidence goes into `plan/fix-plan-<repo>.md` as the root-cause
   section, not just the fix shape.
4. Find what changed recently. Run `git -C <repo> log --since="30 days ago"
   --oneline -- <suspect files>` and `git -C <repo> blame -L <line>,<line>
   <file>` on the faulty line. Record the commit, its PR id (from the merge
   message) and the date in the root-cause section. A bug that appeared with a
   recent change is fixed in the light of that change, not around it.
5. Detach and restart the service in normal mode before the live-verification
   step — a service left paused on a breakpoint fails health checks and can
   look like a second bug.

Skip this step only when the root cause is already proven by request/response
evidence alone (e.g. a route mismatch) — state that explicitly in the design
doc instead of silently skipping.

## Step 3 — Write a fix design doc per repo

1. For each affected repo, write `plan/fix-plan-<repo>.md`. Cite exact file
   names and line numbers from the real source — never guess line numbers.
2. If the fix spans two or more repos, write one extra doc,
   `plan/FIX-PLAN.md`, that links to each per-repo doc rather than repeating
   its content.
3. In `plan/FIX-PLAN.md`, check that each repo's design still matches the
   other repo's actual chosen design — don't assume they match; state the
   check result in plain words.
4. In `plan/FIX-PLAN.md`, list every possible deploy order (repo A first, repo
   B first, both together). For each order, state what the user will see,
   step by step — don't assume "no regression" without this list.
5. Before implementing a design doc, check a few of its file:line citations
   against the current source — it can drift after the doc was written.
6. Smallest change. The doc lists every file the fix will touch and nothing
   else. A file outside the list needs a one-line reason in the doc before it
   is edited.
7. The failing test comes first. Name the test file and the test function in
   the doc, then write the test, run it, and record the failing output in the
   doc under `## Failing test`. Only then write the fix. The test lives where
   `regression-test-placement` says for the kind of thing that broke
   (code, API field, assistant answer or tool call, generated file, component,
   journey).

**Returned bug:** write `plan/fix-plan-<repo>-r<n>.md` and, for two or more
repos, `plan/FIX-PLAN-r<n>.md`. Never edit the earlier plan files. Each
per-repo doc has a required `## Why the previous fix failed` section. It
cites the merged commit SHA and the exact file:line the first fix changed,
and names the case the first fix missed.

**Consent is already given.** A session whose task is "Fix bug N" has
implementation consent from the first message. Do not pause between the
design doc and the code for an extra go-ahead, and do not block todos waiting
for one. The only ask-first gates are the review/done ADO transitions that
RULES.md does not exempt. The PR-open Slack notification needs no approval.
Step 5 opens the PR without asking.

## Step 4 — Live-verify the fix, not just unit tests

See `e2e-verification` for the concrete auth-bypass and
Blob-verification techniques. General rules:

1. If a local dev proxy sits between client and backend, don't trust a
   browser-only test of a network-level event (e.g. a client disconnect) —
   the proxy may not pass the event through. Test directly against the
   backend port instead (e.g. a `curl` with a connection timeout).
2. A live local UI check logs in as the shared test user. Follow
   `e2e-verification`, Local browser login. Never ask the
   user to log in for a local check. A QA UI check still needs the user to
   log in.
3. A fix that depends on specific library/framework/proxy behavior needs one
   live test against the real dependency — a mock is not proof. State the
   real result in your report.
4. Run the repo's PR-build checks from `service-startup-reference`,
   section "PR-build checks per repo". Live verification supplements this; it
   does not replace it.
5. Mutation check. Remove the fix from the run, keep the tests in the tree,
   and run the new test: it must fail. Restore the fix and run it again: it
   must pass. Pick the form with `git diff --quiet HEAD -- <files>` (stash
   for an uncommitted fix, checkout from `origin/main` for a committed one),
   as `regression-test-placement`, section "Mutation check per stack",
   gives it, with the single-test command per stack.
   Write both outputs into the fix plan under `## Mutation check`. A test that
   passes without the fix does not guard the fix; rewrite it before the
   commit.
6. Regression placement. For every kind of thing that broke, add the matching
   regression test per `regression-test-placement`. An orchestrator bug
   that changes what the assistant says or does always gets a prompt-catalogue case,
   proven against the local orchestrator before the PR.
7. UI bugs with a `docs/flow.yaml`: run `flow-runner` with `expect: fixed`
   against the fix branch, read `result.yaml` yourself, and check one
   screenshot against its citation. Write the run line under `## Flow runs`
   on the vault task page. See `flow-schema` Step 4.
   A returned bug uses `docs/flow-r<n>.yaml` for the `expect: fixed` run.
8. Tear down verification tooling once live verification and the test suite
   both pass: close any open Playwright browser/tab, and stop any dev
   server or service started only for this verification (`services` `action: stop`).
   Leave nothing running past this step that wasn't already running before
   the workflow started.

## Step 5 — One commit per repo

1. Put the code change and its tests in one commit per repo.
2. If a live test finds one more real bug, or a wrong test mock, fix it in
   the same commit — `git commit --amend` and force-push your own branch, not
   a second commit. Before the force-push, run
   `./secret-scan.sh <task>/<repo>` from `~/work/<PROJECT>/tasks`; push only on
   `RESULT: clean`.
   Write the commit message to a file with the `write` tool and use
   `git commit -F <file>` (same for `--amend`). A heredoc inside
   `-m "$(cat <<'EOF' ...)"` gets mangled by shell quoting — observed in a
   real run; the mangled message then needs an amend anyway.
3. Self-review before the commit. From `~/work/<PROJECT>/tasks` run
   `./self-review.sh <task>/<repo>`. It writes `<task>/review/self-<repo>.diff`
   and prints five sections: files changed, new code comments (`#` in `*.py`,
   `//` in `*.ts`/`*.tsx`; docstrings are not comments), env and secret
   files, dependency changes, secrets in content (gitleaks). Check the file
   list against the fix plan: every file is in the plan. A dependency change
   is named in the PR `## Why` or `## Fix` section with a reason. Fix every
   finding; the script exits 1 until it prints `RESULT: clean`.
4. **Security gate.** Run `pr-security-gate`. Its result goes into
   `<task>/review/SECURITY-GATE.md`.
5. **Open the PR without asking** (user decision, 2026-10-16). Open one PR per
   repo against its default branch (`main`) once all of these are true: the
   bug reproduced, the new test failed before the fix and passes after it, the
   mutation check passed, the PR-build checks pass, the live check passed,
   the self-review printed `RESULT: clean`, and the security gate passed
   (clean, deferred findings only, or the draft-PR path). If one item fails,
   do not open the PR. The draft-PR path of `pr-security-gate` opens the
   PR as a draft. See `pr-creation` for the title, the description
   template, the work-item link, and the reviewer list. See
   `pr-and-team-comms` for who to notify.

   Post the PR-open Slack notification without asking, except for a draft PR, in the format from
   `pr-and-team-comms`, section "PR-open notification". Move the work item to a review/done state
   only as the RULES.md state exceptions allow. Ask before any other
   review/done move.

   **Returned bug:** merged mode opens a new PR from `fix/<slug>-<N>-r<n>`. Its
   template A `## Root cause` section gives one sentence on why the earlier
   change missed this case, with the earlier PR URL. Open-PR mode pushes to
   the existing PR (own commit: amend and force-push; colleague's branch: a
   new commit on top, per bootstrap Step 3a). Before that push, run
   `pr-security-gate` with base `origin/<src>`. It opens no new PR.

## Step 6 — Link each PR to the work item

See `pr-creation` for the exact mechanism and the re-fetch-to-verify
requirement. Don't trust the link call's own success response alone.

## Step 7 — Move the work item to its next real state

Don't stop at `Ready for Fix`. The Bug state path is in `.omp/AGENTS.md`.

- **User rule (2026-09-17): stay on `Ready for Fix` for the entire time the
  PR is open, in review, or being revised.** Opening the PR does not move
  the state by itself. Only once the PR completes (merges) does the state
  move — directly to `Resolved`.
- **PR completion is now the trigger for `Resolved`, per the user rule
  above** (previously `Resolved` was set at PR-open time and completion
  triggered `Ready for Retest` directly — that no longer applies). When a
  PR completes (merges) and it is the only PR linked to the bug, move the
  bug from `Ready for Fix` to `Resolved` right after completion. Completing
  the PR does not auto-transition the work item in this project, even with
  `transitionWorkItems: true` set on the completion call — write the state
  change yourself and re-fetch to confirm it stuck.
- The subsequent `Resolved → Ready for Retest` move follows the QA deploy
  check in `tasks-deployed-to-qa`, without a prompt (RULES.md state
  exceptions). It never happens at merge time.
- If more than one PR is linked to the bug, wait until every linked PR has
  completed before moving to `Resolved`.
- Abandoned PRs do not count in "every linked PR has completed". A returned
  bug follows the same `Ready for Fix → Resolved` rule.
- `Closed` belongs to the tester. The agent never writes it.

After the merge, run `post-merge`: dev deploy check, dev evidence, the
tester handoff document and the ticket comment draft.

If ever unsure of a project's exact state names, fetch the work item type's
states once (`get_type`) and use the real list — don't guess.

## Step 8 — Communicate with the team and record the vault entry

Both covered in `pr-and-team-comms`: post the PR-open notification (no
draft, no approval; default `#<team-channel>`, unless the user names
another channel), and add one `decisions/YYYY-MM-DD-<slug>.md` page per repo
with a real code change, linked to the project page. Reusable facts go in
`notes/`.

## Operational notes

- Send one `good` worker per repo, in parallel, not sequentially, for the
  fix-implementation phase. Give each its own exact file list, exact test
  names, and the exact live-verification command. Workers share no context —
  write everything they need into the task.
- Do not accept a worker's report as proof. Read the real diff, the real test
  file, the real command output. Only then mark the step done.

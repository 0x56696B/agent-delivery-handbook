---
name: story-workflow
description: Use for Session B of a platform User Story — the autonomous implementation session that picks up a Ready for Development ticket by number alone, validates the Agent Contract written by story-refinement, runs ticket-bootstrap itself, then implements, verifies, opens the PR without a prompt, releases resources, and posts the PR-open team notification. Trusts only the ticket; escalates by ADO comment, never by reinterpreting the contract.
---

# Session B — Story implementation (autonomous)

This is the second half of the two-session story workflow. Session A
(`story-refinement`) or `/triage` already grilled the user and wrote the Agent
Contract into the ticket description or into a ticket comment. This session starts blank: its only
input is the ticket number, and its only source of intent is the ticket.
It runs autonomously from the contract gate through PR creation and resource cleanup. It does not stop for approval; it posts the PR-open Slack notification itself.

## Step 0 — Contract gate (before touching anything)

Fetch the work item and call `list_comments` for it. The gate passes only when BOTH hold:

1. State is `Ready for Development`.
2. The description, or the newest comment whose heading starts with `## Agent Contract (Ready for Development)` (a `(1/2)` or `(2/2)` suffix is allowed; when the contract is split, read both parts as one), contains the
   section with all six subsections present and non-empty: acceptance
   criteria (restated, testable), resolved questions, affected repos with
   non-goals, verification plan, deploy-order notes, stop conditions. Any
   `TBD` or placeholder text fails the gate.

**On failure:** post an ADO comment naming each specific gap (comments are
for reasons and questions — tag the person who ran refinement or the PO),
move the state back to `In Refinement`, re-fetch to confirm, and stop. Do
not create folders, branches, or code. Do not compensate for a thin ticket —
the refusal IS the quality mechanism.

**On pass:** the contract is now the specification. Do not reinterpret it.

## Step 1 — Bootstrap

Run `ticket-bootstrap` now (task folder, `feat/<summary>` branch,
worktrees, symlinks, exclusions). The initial-ADO-state step of bootstrap
does not apply here — the state is already `Ready for Development`; verify,
don't set.

If a `STORY-<NUM>-*` folder already exists, the story is a resume. Call
`move_session` with that folder name first, then skip the bootstrap steps
that already ran. Bootstrap refuses a second folder for the same ticket.

## Step 2 — Move to `In Development`, write plan docs per repo

Move `Ready for Development → In Development` (write, re-fetch, confirm).

Then, for each affected repo named in the contract:

1. Write `plan/story-plan-<repo>.md`. Cite exact file names and line numbers
   from the real source — never guess line numbers.
2. If the story spans two or more repos, write one extra doc,
   `plan/STORY-PLAN.md`, linking to each per-repo doc rather than repeating
   its content, checking that each repo's design matches the others' actual
   chosen design, and restating the contract's deploy-order notes against
   the real design.
3. Map every contract AC to the specific place in the plan that satisfies it
   AND to its verification from the contract's verification plan. An
   unmapped AC is a gap — see the escalation rule, not something to fix
   silently later.
4. The plan is self-checked against the contract. There is no user ack and
   no plan posted as a comment — the contract already carried the human
   sign-off.

## Escalation rule (applies from here to the end)

Stop conditions — the contract's own `Stop conditions` section, plus these
standing ones:

- the code contradicts a contract item (an AC is unimplementable as stated,
  a resolved answer is wrong against real source),
- the work needs a repo the contract did not name, or touches a named
  non-goal,
- an AC maps to nothing in the plan, or its named verification cannot be run.

On any of these: post an ADO comment stating the contradiction with
file:line evidence, tag the relevant person, move the state to `Blocked`,
and stop. Never reinterpret the contract, never widen scope silently.

## Step 3 — Implement

- Send one `good` worker per repo, in parallel, not sequentially. Give each
  its own exact file list, exact test names, and the exact live-verification
  command from the contract's verification plan. Workers share no context —
  write everything they need into the task.
- Follow the plan doc's citations, but re-check them against live source
  first — don't blindly trust a doc written even a few hours earlier.
- Do not accept a worker's report as proof. Read the real diff, the real test
  file, the real command output. Only then mark the step done.

## Step 4 — Test, including a live check

Run each affected repo's real test suite (see `service-startup-reference`
for which repos exist and `e2e-verification` for live
Azure-backed verification techniques — auth bypasses, real Blob checks,
director-level HTTP verification):

- Run the repo's PR-build checks from `service-startup-reference`,
  section "PR-build checks per repo". That table is the only source of the
  commands; do not copy it here. `media-mcp` and `data-mcp`
  mark real-external-API tests with `@pytest.mark.integration`; the PR build
  skips them, so run them once against real dependencies before the story is
  called done. `infra` has no local step; its
  `gated-infra` pipeline validates the PR.
- Test first for every AC that describes a behaviour. Write the test, run it,
  record the failing output in `plan/story-plan-<repo>.md` under
  `## Failing tests`, then implement. Place each regression test per
  `regression-test-placement` (code, API field, assistant answer or tool call,
  generated file, component, journey). An AC that changes what the assistant says or
  does gets a prompt-catalogue case, proven against the local orchestrator.

A live web-app UI check runs in the Playwright browser on port 5173 and
logs in by itself (`e2e-verification`, Local browser login).
Do not ask the user to log in.

A mock passing is not proof. Every AC whose verification in the contract
names a live check gets that live check run for real, and the real result
stated in the report.

## Step 5 — Verification gate (before any PR)

One commit per repo (code + tests together; amend, don't add a second
commit, if a live test surfaces one more real issue).

The gate passes only when every item holds. Each item needs real command
output read in this session, not a worker report:

1. **Build.** The repo builds. web-app: `pnpm run typecheck` and
   `pnpm run build`. Python repos: `uv sync` succeeds and the service
   imports/starts.
2. **Tests and lint.** Every command in the PR-build checks table passes,
   including the `integration`-marked tests once.
3. **Runs.** Each changed service starts locally through `services`
   and answers a real request on the changed path.
4. **Does what the task says.** Every contract AC has its contract
   verification run for real, live checks included, with the observed
   result recorded.
5. **Conforms to the plan.** Re-read each `plan/story-plan-<repo>.md` (and
   `plan/STORY-PLAN.md`). Compare it with the real diff
   (`git -C <repo> diff main...HEAD`). Every planned change exists. No
   unplanned file or behavior exists.
6. **Mutation check.** For every new unit test: remove the implementation
   from the run with the form that `regression-test-placement`, section
   "Mutation check per stack", picks by `git diff --quiet HEAD -- <files>`
   (the gate runs after the one-commit step, so the fix is usually
   committed: checkout from `origin/main`, not stash). Run the test, it must
   fail; restore the implementation, run again, it must pass. Record both
   outputs in `plan/VERIFICATION.md`. A test that passes without the change
   fails the gate.
7. **Self-review.** From `~/work/<PROJECT>/tasks` run
   `./self-review.sh <task>/<repo>`. Every file in its `## Files changed` is
   in the plan. It must print `RESULT: clean` (no new code comments in
   `*.py`/`*.ts`/`*.tsx`, no env or secret file, no secret in content). A
   dependency change it lists is named in the PR `## Why` with a reason.
8. **Security gate.** Run `pr-security-gate`; its result is recorded in
   `review/SECURITY-GATE.md`. The gate passes on a clean verdict, on
   deferred findings only, or on its draft-PR path.

Write the result as an AC → evidence table in `plan/VERIFICATION.md`: one
row per AC with the AC, the command or check, and the observed result.

If any item fails and cannot be fixed inside the contract, apply the
escalation rule. Never open a PR on a failed gate.

Pushing the branch to ADO before the gate passes is allowed (CI feedback,
backup). Before each such push, run `./secret-scan.sh <task>/<repo>` from
`~/work/<PROJECT>/tasks`; push only on `RESULT: clean`. The gate controls only PR
creation.

Use ADO comments for progress notes and tagging people through this phase —
short, reason-or-question-shaped, never a plan dump.

## Step 6 — Open the PR (no user prompt)

Gate passed: open one PR per repo directly. Do not ask the user. The
verification gate is the authorization.

- Follow `pr-creation` for the branch and title shape (`feat/<title>`
  branch, `feat(scope): description (STORY-NNNNNN)` title), the description
  template, the work-item link, and reviewers. Fill the `## Evidence` section with the before and after images from the flow-runner run folder for every visual change.
- Do NOT arm auto-complete (skip the "Auto-complete safety" part of
  `pr-creation`).
- Paste each PR URL in the final report.
- Draft-PR path of `pr-security-gate`: open the PR with `isDraft: true`,
  skip the Step 9 PR-open notification, and say in the final report that the
  PR is a draft and which finding holds it.
- Leave the ticket state at `In Development`. Do not move it to `Ready for
  Test`. That state follows the PR merge (Step 8).

## Step 7 — Release every resource used

Run right after the PRs open, before the Slack notification:

- **Playwright:** call `mcp__playwright_browser_close` if this session
  opened a browser.
- **Services:** stop every service this session started with `services` `action: stop`. Check `port_free` and, for debug starts, `debug_port_free` in the result.
- **Docker:** for each compose project this session brought up, run
  `docker compose down` (no `-v`; keep volumes) in that directory. Stop only
  containers this session started.
- Never stop a process or container this session did not start (process
  ownership rule).
- Confirm: `lsof -nP -iTCP:<port> -sTCP:LISTEN` returns nothing for every
  port this session used, and `docker ps` shows none of this session's
  containers. Report any leftover as a blocker.

## Step 8 — Move through test and acceptance

- Once the PR is merged (any later session that observes `status: 3` /
  completed on every story PR): move `In Development → Ready for Test`
  without asking the user. Write, re-fetch, confirm. Then run
  `post-merge`: dev deploy check, dev evidence, tester handoff document,
  ticket comment draft.
- Once `tasks-deployed-to-qa` proves the change is on QA: → `In Test`,
  without a prompt (RULES.md state exceptions).
- `Pending PO Review` and `Accepted` belong to the tester and the product
  owner. The agent never writes them (RULES.md). It records them when it sees
  them.

If any AC fails at this stage, that is a real signal the contract or the
plan missed something — comment on the ticket with the evidence and route it
back through the escalation rule; don't patch around it silently.

## Step 9 — Communicate with the team and record the vault entry

Both covered in `pr-and-team-comms`: post the PR-open notification
(default `#<team-channel>`, unless the user names another channel)
immediately after Step 7, in the format from `pr-and-team-comms`,
section "PR-open notification". No draft, no approval. Add
one `decisions/YYYY-MM-DD-<slug>.md` page per repo with a real code change,
linked to the project page, including the tradeoffs recorded in the contract's
resolved questions, not just the final shape of the code. Reusable facts go in
`notes/`.

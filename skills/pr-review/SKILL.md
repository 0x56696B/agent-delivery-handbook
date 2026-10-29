---
name: pr-review
description: Use when given an Azure DevOps PR number for the platform project and asked to review it — covers locating the PR's repository, wiring a worktree of the PR's real source branch via `setup-task-branch.sh --pr` (which creates the PR-REVIEW-{NUM}-{summary} task folder itself and checks for an existing folder for the same PR), pulling linked work items, staging a review context + diff, fanning out security-reviewer, reviewer, and architect-reviewer agents, and compiling a verdict on suspicious/malicious content, code quality/spec match, and cross-service architecture tradeoffs. Follows the same task-folder vibe as ticket-bootstrap, but the branch already exists remotely and only one repo is wired.
advisors: [PRSecurity]
---

## Input

- `pr_number` (e.g. `4501`) — the only input the invoker supplies.
- The repository is NOT a separate input. Discover it in Step 1.

## Step 1 — Locate and fetch the PR

MCP tool `repo_pull_request`:

1. `get` requires `repositoryId`, which you don't have yet. First run
   `list` with `project` + `status: "All"` and find the PR number in the
   result — that row names the repository. Recent PRs appear near the top.
2. Then `get` with `repositoryId`, `pullRequestId`,
   `includeWorkItemRefs: true`, `includeChangedFiles: true`.

Capture: title, full description (verbatim — the reviewer agents compare
code against it), source/target branches, head commit
(`lastMergeSourceCommit`), status, author, reviewers + votes,
`workItemRefs`, and the changed-file list. A changed file the description
never mentions is already a spec-match lead — hand it to the reviewers.

## Step 2 — Fetch linked work items

For each `workItemRefs` id: `wit_work_item` action `get` with
`expand: "All"` (enum is capitalized — `"relations"` is rejected). Capture
type, title, state, description/repro verbatim, and parent. The work item
text is the spec the PR claims to implement; the reviewers get it verbatim.

## Step 3 — Check out the PR branch as a worktree

`setup-task-branch.sh` supports a `--pr` mode for exactly this case: one
repo, one branch that already exists on origin, checked out instead of
created off the default branch, with no `.env` symlink. From
`~/work/<PROJECT>/tasks`: 

    ./setup-task-branch.sh --pr <repo> --target-branch <target-branch> \
        <src-branch> PR-REVIEW-{NUM}-{summary}

- `<repo>` is the plain repo name (no `-bare` suffix), `<src-branch>` and
  `<target-branch>` are the PR's source and target branches from Step 1.
  Omit `--target-branch` when the target is `main`.
- `PR-REVIEW-{NUM}-{summary}`: `{NUM}` is the PR number, `{summary}` is a
  short human paraphrase of the PR title or source branch, dash-cased (e.g.
  `PR-REVIEW-4501-settings-env-fail-closed`). **The script creates this
  folder itself** — never create it yourself first. It also checks
  `~/work/<PROJECT>/tasks` for an existing `PR-REVIEW-{NUM}-*` folder under a
  different summary slug and refuses to create a duplicate; reuse the
  folder name it names if that happens.
  
- This fetches both branches with explicit refspecs, adds the worktree
  from `origin/<src-branch>`, and symlinks it into the task folder as
  `PR-REVIEW-{NUM}-{summary}/<repo>` — no hand-run git commands needed.
- Verify the head commit of the worktree equals the PR's
  `lastMergeSourceCommit` — if not, the branch moved; re-run the command.
  
- After the script succeeds, create the `review/` subdirectory it does not
  own: `mkdir -p PR-REVIEW-{NUM}-{summary}/review`.
  

## Step 3b — Wire LSP and DAP

From `~/work/<PROJECT>/tasks`:

    ./setup-task-lsp.sh PR-REVIEW-{NUM}-{summary}

Then call the `move_session` tool with `PR-REVIEW-{NUM}-{summary}` (see the
move rule in `.omp/RULES.md`). Paths in later steps resolve inside this
folder, so `PR-REVIEW-{NUM}-{summary}/review/` is `review/`. The generator
touches no `.env`, so this step keeps the skill's read-only posture. See
`ticket-bootstrap` Step 4b for the full adapter/port reference. A PR
review folder wires only the one repo checked out in Step 3.

## Step 4 — Stage the review inputs

In `PR-REVIEW-{NUM}-{summary}/review/`:

- `PR-CONTEXT.md` — PR metadata, description verbatim, each linked work
  item verbatim, changed-file list, worktree + diff paths.
- `diff.patch` — from inside the worktree:
  `git diff origin/<target>...HEAD > <ABSOLUTE path>/review/diff.patch`.
  Use an absolute output path: shell redirects resolve the task-folder
  symlink physically, so `../review/` points inside the bare repo, not the
  task folder.

Read the diff yourself before delegating — you write the final summary and
must be able to challenge the agents' claims.

## Step 5 — Fan out the reviewer agents

One `task` batch, three agents, all pointed at `PR-CONTEXT.md`, the
worktree, and `diff.patch`:

- **`security-reviewer`** → `review/SECURITY-REVIEW.md`. Question: anything
  suspicious or malicious? Instruct it to (a) study the diff line by line
  for backdoors, logic inversions, weakened guards, exfiltration; (b) trace
  every consumer of the values the diff changes and classify each as
  fails-closed / fails-open / crashes; (c) check type changes against
  consumers that assume the old type; (d) verify new tests assert what they
  claim and flag weakened/removed assertions; (e) rule on any changed file
  the PR description omits.
- **`reviewer`** → `review/QUALITY-REVIEW.md`. Three axes: repo-convention
  quality/consistency; spec match (ticket scope missing from the PR, PR scope
  missing from the description, description claims the code does not
  implement); and test strength: a regression test exists and sits where
  `regression-test-placement` says, the PR or its plan records a mutation check (the test failed with the fix
  removed and passed with it back; a missing record is a finding, not a
  reason to run tests here), `## Evidence` holds before and
  after images for a visible change, no new code comments, no new dependency
  without a reason, smallest change. Worked example for "one real way it
  could break": a fix once matched "please confirm" anywhere in the assistant's reply
  and cut short every drafted email that contained those words.
  Verdict: mergeable as-is / mergeable with nits / needs
  changes.
- **`architect-reviewer`** → `review/ARCHITECTURE-REVIEW.md`. Cross-service
  and cross-module tradeoffs the other two lanes don't own: boundary
  breaks, contract stability for other repos' consumers, whether a new or
  changed API response field is added to
  `orchestrator/e2e/support/contracts.py` (its models use
  `extra="forbid"`, so an unlisted field fails the e2e run), and design choices
  that concentrate risk or diverge from the repo's existing patterns.
  Verdict: mergeable as-is / mergeable with follow-up / needs architectural
  changes.

Shared contract for all three: read-only, no formatters/linters/test suites,
every finding cites file:line, `## Verdict` first then `## Findings` with
Critical/High/Medium/Low/Info ratings.

## Step 6 — Compile the result

Write `review/REVIEW.md`: one combined summary that answers, in order:

1. Suspicious or malicious content — yes/no, with the evidence.
2. Does the change do what the description + work item claim? Scope gaps
   both directions.
3. Code quality/consistency findings worth flagging, by severity.
4. Cross-service architecture tradeoffs worth flagging, by severity.
5. Recommended action (approve / approve with comments / request changes).

Spot-check each agent claim you repeat — cite file:line yourself, not
"the agent said". Check each claim against the diff or the template before
you repeat it: a lane may mark a claim as inference, and another lane may
have verified the opposite.

### Chat report layout

The chat report has two parts, in this order, separated by a horizontal rule
(`---`) and a bold heading for each part:

1. `**Ticket summary**` — 3 to 5 lines from the linked work item(s) fetched in
   Step 2: ID, type, title, one line on the problem or ask, and the PR's
   claimed fix. No linked work item: say so in one line.
2. `---`, then `**Review summary**` — the five answers from `REVIEW.md`,
   ending with the recommended action.

Write the same two parts at the top of `review/REVIEW.md`, so the file and the
chat match.

## Boundaries

- Never vote on, comment on, or complete the ADO PR from this skill
  without explicit user approval in the session (standing ask-first rule).
- **PR-scope rule for everything posted to ADO:** every thread's *anchor*
  (the `filePath` + line range it attaches to) MUST be a file in the PR's
  changed-file list, on lines inside its diff hunks — never anchor on a
  file the PR does not touch (learned on PR 4501: a docs-file thread
  outside the diff had to be deleted). A comment's *text*, once anchored
  that way, MAY cite an untouched file when the diff's own change reaches
  into it — e.g. a new patch list that misses an existing by-name import
  in an untouched module, or a new test whose behavior depends on an
  untouched module's existing return value (learned on PR 4502: this is
  the finding, not scope creep). What still never becomes a thread:
  findings about surrounding code, docs, or repo hygiene the PR's diff
  does not reach into at all — those go in `review/REVIEW.md` and the
  chat summary only. Likewise strip incidental external data a comment
  doesn't need to make its point — ADO build/pipeline-run IDs, other
  pipeline files in the same repo, other repos' branch contents — unless
  that data is itself the finding.
- When drafting comment text: follow `COMMENT-STYLE-NOTES.md` in this skill's own directory
  (short plain-language comment, small proposed-fix code block only when the fix is genuinely
  contained, no code comments inside proposed fixes).
- When the user approves posting findings: `repo_pull_request_thread_write`
  action `create`, one thread per finding, file-anchored via `filePath` +
  `rightFileStartLine`/`rightFileEndLine`. Gotchas: the API rejects a line
  anchor without BOTH `rightFileStartOffset` and `rightFileEndOffset` (use
  offset 1 and the line's length). Draft the comment text in chat and get
  approval BEFORE posting — in the user's own voice, since it posts under
  their identity.
- Removing a posted comment: the MCP thread tool has no delete action. Use
  `az devops invoke --area git --resource pullRequestThreadComments` with
  `--http-method DELETE` and route params `project`, `repositoryId` (GUID),
  `pullRequestId`, `threadId`, `commentId`, then `update_status` the empty
  thread shell to `Closed`. Verify by re-listing threads.
- Never push to the PR branch; the worktree is for reading.
- Cleanup (optional, on user request): `git worktree remove` the PR branch
  worktree and `git branch -D` the local branch; the task folder with
  `review/` stays as the record.

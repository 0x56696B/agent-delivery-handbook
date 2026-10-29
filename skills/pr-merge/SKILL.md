---
name: pr-merge
description: Use when the user asks to merge or complete their own pull request on the platform, by PR number or with no number to scan all their active PRs. Checks approvals, merge conflict, PR pipeline, paired-PR order, review threads, and the blocking branch policies when the Azure CLI is logged in; closes threads that a later approval supersedes; asks about chit-chat threads; offers pr-comments for real feedback and merge-conflict for a conflict; arms squash auto-complete after one combined approval; then moves the linked work item one rung, files vote-5 suggestions and closes the vault task page, and appends the log entry. With no PR number it only lists and lets the user pick; it never merges an unpicked PR. Never bypasses a policy and never touches a PR by another author.
---

## Input

`pr_number`, optional.
Present → run the single-PR flow (Steps 1 to 8). Empty → run the "Scan flow"
section. The repo, the task folder, the linked work item, and the vault task
page are discovered here, never supplied by the invoker.

## Step 1 — Find the PR, then gate

Read `skill://merge-conflict`. Run its Step 1 (find the PR across the six
repos) exactly as written, with `includeWorkItemRefs: true` on every `get`.

Then route on `status` (`PullRequestStatus`: 1 Active, 2 Abandoned, 3
Completed), running no git command and no script:

- `2` → stop and report. An abandoned PR is a human decision.
- `3` → say the PR is already merged, then go to Step 6. The post-merge steps
  may still be open.
- `1` → continue.

Stop and report when `createdBy.uniqueName` is not
`<YOUR_EMAIL>`. Name the author, the repo, and the PR URL. This
skill merges the user's own PRs only. It never edits, pushes, or merges a
branch that belongs to another person.

Capture from the `get`: `repositoryId`, `title`, `sourceRefName`,
`targetRefName`, `mergeStatus`, `reviewers[]` (`uniqueName`, `displayName`,
`vote`, `isRequired`), `autoCompleteSetBy`, `workItemRefs[]`. `<repo>`,
`<src>`, and `<target>` below carry the same meaning as in that skill.

## Step 2 — Build the gate table

Five reads, in parallel:

1. **Votes.** From `reviewers[]`. Vote values: 10 approved, 5 approved with
   suggestions, 0 no vote, -5 waiting for author, -10 rejected.
2. **Threads.** `repo_pull_request_thread` action `list` with `fullResponse:
   true`. Classify them as shown below.
3. **Pipeline.** Classify with `skill://my-pr-status` Step 2a: the newest
   build on `refs/pull/<pr_number>/merge` (`pipelines_build` `list`, `top:
   5`), plus `repo_branch` `get` of `main` for the tip. Classes: `passed`,
   `running`, `failed`, `stale`, `no run`.
4. **Work items.** For each id in `workItemRefs[]`, `wit_work_item` action
   `get` with `expand: "Relations"`. Step 6 and the paired-order gate use
   the result.
5. **Policies, best effort.** The policy read checks what the other rows
   cannot see, such as minimum reviewers or a required Owner. It adds the
   reason a merge would wait (a required reviewer, a build). No MCP tool
   exposes policy evaluations, so this is the "no MCP tool covers the
   operation" exception in `.omp/rules/azure-cli-fallback.md`:

   ```bash
   az repos pr policy list --id <pr_number> \
     --org "https://dev.azure.com/<ADO_ORG>/" -o json --only-show-errors
   ```

   `az` keeps no session. On an auth error, offer the login once:

   ```bash
   az login --tenant $CLIENT_AZURE_TENANT_ID --subscription $CLIENT_AZURE_SUB_ID_AI_DEV
   ```

   Read both ids from `vault://wiki/projects/infra.md` first
   and export them in the shell. Never hardcode them, never use a PAT. The
   login opens a browser, so ask before you run it. Then retry the list once.
   The user declines the login → mark the Policies row `not read` and
   continue; Step 5 covers a merge that waits.

   With data: keep every record with `configuration.isBlocking: true` and
   `configuration.isEnabled: true`. Record `configuration.type.displayName`
   and `status`. `status` is one of `queued`, `running`, `approved`,
   `rejected`, `notApplicable`, `broken` (REST `PolicyEvaluationStatus`).

### Vote times

From the thread list, take every thread whose
`properties.CodeReviewThreadType.$value` is `VoteUpdate`. The voter is
`identities[properties.CodeReviewVotedByIdentity.$value].uniqueName`. The vote
is `properties.CodeReviewVoteResult.$value`. The time is the thread
`publishedDate`.

A reviewer's **approval time** is the `publishedDate` of that reviewer's
latest `VoteUpdate` thread. It is valid only when that thread's result is
`10` or `5` AND the reviewer's current `reviewers[].vote` is `10` or `5`.
Otherwise the reviewer has no approval time.

### Classify threads

Open threads use the in-scope rule of `skill://pr-comments` Step 2 (first
comment `commentType: 1`, not deleted, `status` 1, 6, or absent), with one
difference: a thread whose last comment is the user's own reply is still
**open** here. It waits on the reviewer, and it still blocks the merge. Tag
each `feedback` thread `waits on me` or `waits on reviewer`.

Classify each open thread, in this order:

| Class | Rule | Effect |
|---|---|---|
| `superseded` | Every comment author on the thread other than `<YOUR_EMAIL>` has an approval time later than the `lastContentUpdatedDate` of that author's own last non-deleted comment on the thread | This run sets the thread to `Closed`. No reply. |
| `chit-chat` | Not `superseded`, and no comment by another person asks for or proposes a change, fix, or answer about the PR (praise, thanks, acknowledgement only) | Ask the user in Step 5. "Close" → treat as `superseded`. "Keep open" → treat as `feedback`. |
| `feedback` | Anything else, including a thread by someone with no approval time | Blocks the merge. |

Show this table, one row per gate:

| Gate | Evidence | Pass rule |
|---|---|---|
| Approvals | approver names and votes | at least one vote of 10 or 5 from a reviewer who is not the author, and no vote of -5 or -10 from anyone |
| Comments | thread ids per class, each with file, author, gist | zero `feedback` threads |
| Conflicts | `mergeStatus` | `3`. `0` or `1` → re-`get` after 15 seconds, up to 4 times. `2` is a conflict. |
| Pipeline | class and build id | `passed`. `running` → re-check after 30 seconds, up to 4 times. |
| Paired order | partner PRs and status | see below. Passes when the title has no `(k/n)` suffix or `k` is 1. |
| Policies | one line per blocking policy: `configuration.type.displayName` and `status`; or `not read` | every judged policy is `approved` or `notApplicable`. Not judged here: policies with displayName `Build` (the Pipeline row judges them) and `Comment requirements` (Step 5 closes the threads, so a pending status is expected; the Comments row judges threads). `not read` does not block, and the row still shows `not read`. |

Display rules. The user chose these on 2026-10-12. The table in chat and the
Step 5 summary follow them:

- Show no raw numbers to the user: no vote values, no `mergeStatus`, no enum
  codes. Map each to words.
- Approvals: the approver name and the word "approved". A vote of 5 (approved
  with comments) adds `*` after "approved". Put the legend at the bottom of
  the table: `* = approved with comments`. Keep the legend line even when no
  approver has `*`. Waiting for author and rejected show as those words.
- Conflicts: `3` → "None. The PR merges cleanly into `<target>`." `2` →
  "Conflict with `<target>`". `0` or `1` → "Checking". `4` → "Blocked by
  policy". `5` → "Merge check failed".
- Pipeline and Policies: show the build id and the state in words
  (passed, stale, failed), never the numeric result.

Paired order: the PR title ends with `(k/n)` and `k > 1` → from the work item
relations in read 4, take every `ArtifactLink` with `attributes.name: "Pull
Request"`. Parse the repo GUID and PR id from
`vstfs:///Git/PullRequestId/{project}%2F{repo}%2F{prId}`, then `get` each one
(`repositoryId` = the GUID). Every partner whose title ends with `(j/n)` with
`j < k` must have `status: 3`. No work item, or no `(j/n)` partner found →
fail with "cannot find the (j/n) partner".

The Owner rule (1 approval from a repo Owner, `pr-creation` Mechanics)
has no machine-readable owner list. Name every approver so the user judges
it. Never vote on the PR to satisfy this gate.

Every row passes → Step 5. Otherwise → Step 3.

## Step 3 — Clear each failing gate

Work the gates in this order: 3a conflict, 3b feedback threads, 3c approvals,
3d pipeline, 3e paired order, 3f policies. A push resets votes and re-queues
policies, so code changes come before approval asks.

### 3a — Conflict (`mergeStatus: 2`)

Offer two options and wait for the choice: a subagent resolves it, or stop.

On "resolve": run `merge-conflict` Steps 2, 3, 3b, and 4 yourself.
These steps run the setup script and stop for the user's decision, so they
stay in this session. Then spawn one `task`
subagent with this brief, filled in:

```
Read skill://merge-conflict. Run its Steps 5, 6, and 7 for PR <pr_number>
in repo <repo>. <folder>, <repo>, <src>, <target>, <ABS> are: <values>.
The worktree is already synced. Do not run Step 8 or Step 9. Never push.
Write files only under <ABS>/conflict/. Skip formatters, linters, and any
project-wide suite the skill does not name. Report: the conflicted files, each
resolution, the patch comparison from Step 7, the check results, and
`git -C <folder>/<repo> rev-parse HEAD`.
```

Show the subagent's report. Then run `merge-conflict` Step 8 (ask, then
push) and Step 9 yourself. Re-run Step 2 of this skill from the start.

### 3b — Open comments

List every `feedback` thread: id, `filePath:line`, reviewer, one-line gist,
tag. Chit-chat threads are not listed here; they go to Step 5.
Then ask once, with one choice per thread:

- **Resolve here.** After the choices, read `skill://pr-comments` and run
  it for this PR. It owns the fix, the push, and the replies. Threads stay
  `Active`; the reviewer closes them. Threads tagged `waits on reviewer` are
  outside its scope; they take
  the next option.
- **Send to colleague.** Slack DM to the reviewer who opened the thread. One
  DM per person, covering all their threads. See "Slack DM" below.
- **Stop.** Report and end.

Run the "resolve here" set first, then the DMs. Re-run Step 2.

### 3c — Approvals

No qualifying vote, or a -5 or -10 vote: offer a Slack DM to the reviewer
(the one who voted -5 or -10, else a required reviewer with vote 0, else the
user's pick), or stop. The DM asks for a review and carries the PR URL. After
"send it", stop. A vote is a human action; re-run `/pr-merge` once it lands.

### 3d — Pipeline

- `failed` → report the build id and result, then stop. Fixing a build is a
  bug of its own; it is not this skill's work.
- `stale` → re-queue the PR build and wait for it. See "Re-queue a stale
  build" below.
- `no run` → report "no PR build found", then stop.
- `running` after 4 re-checks → report the build id, then stop.

#### Re-queue a stale build

Needs the Policies read. The Policies row is `not read` → report "re-run the
PR build in ADO", then stop.

1. From the `az` policy list, take the record whose
   `configuration.type.displayName` is `Build` and whose
   `configuration.isBlocking` is `true`. Keep its `evaluationId`.
   `context.isExpired` is not `true`, or there is no such record → report
   the build id and stop.
2. Re-queue the policy evaluation. This is the Re-queue button of the PR page.
   No MCP tool covers it, so this is the same "no MCP tool covers the
   operation" exception as read 5. It changes no code and no vote, so it
   needs no extra ask:

   ```bash
   az repos pr policy queue --id <pr_number> --evaluation-id <evaluationId> \
     --org "https://dev.azure.com/<ADO_ORG>/" -o json --only-show-errors
   ```

   A plain `pipelines_write` `run_pipeline` run does not work. ADO does not
   attach that run to the Build policy (tested 2026-10-12, PR 4567).
3. Find the new build: `pipelines_build` `list` on `refs/pull/<pr_number>/merge`,
   `top: 5`, `queryOrder: queueTimeDescending`. Take a build whose `id` is above
   the old one. None after 4 tries, 15 seconds apart → report and stop.
4. Wait: `pipelines_build` `get_status` on it every 30 seconds, up to 10
   times, until the build is completed. Still running → report the build id
   and stop.
5. The result is not `succeeded` → report the build id and result, then stop.
   Fixing a build is not this skill's work.
6. `succeeded` → re-run Step 2 from the start on fresh reads. The Pipeline row
   must read `passed`. The `Build` policy record must read `approved` with
   `context.buildId` equal to the new build id. Every row passes → Step 5.
   Another error → report it and stop. Re-queue once per run. A second
   `stale` → report and stop.

### 3e — Paired order

Report the partner PR(s) not yet merged, then stop.

### 3f — Policies, when the row was read

Any judged blocking policy that is not `approved` or `notApplicable` (for
example `Minimum number of reviewers`, or `Required reviewers` waiting for an
Owner) → report its displayName and status. Offer the 3c Slack DM (target: a
reviewer with `isRequired: true` and vote 0, else the user's pick). Then
stop. Never set `bypassPolicy`.

A `not read` row skips 3f. ADO auto-complete waits for every blocking policy
by itself; it never merges past one.

### Slack DM

Resolve the person with `users_search` by their `uniqueName` email and take
the DM channel id. Draft the message in chat, in a fenced code block, then
wait for "send it". Post with `conversations_add_message` to that channel id.
Send the PR link as a `rich_text` `link` element in `blocks`, with the PR
URL (its `%20` kept) as `url` and the PR number as `text`
(`pr-and-team-comms` "Links in Slack messages"). Set `text` to the plain
message as the notification fallback. The message states the
PR, the thread or vote in question, and the one action asked for. Never
post to a channel from this skill.

## Step 4 — Confirm every gate passes

Re-run Step 2 after the last action in Step 3. Proceed only when every row
passes on fresh reads, counting `chit-chat` threads as pending the Step 5
answer. A table from before a push is stale.

## Step 5 — One combined ask, then merge

1. Compute the Step 6 work-item proposal now. Assume this PR merges: "all
   merged" counts this PR as merged.
2. Show one summary: repo, PR id and title, `<src>` → `<target>`, squash,
   source branch deleted, approvers (display rules of Step 2: no vote numbers),
   pipeline class and build id; the
   `superseded` threads to close (id, author, gist); the threads of each
   vote-5 reviewer that go to the vault (Step 7); the work item move
   `<id> <title>: <state> -> <proposed>` or "no move: <reason>"; the vault
   page action.
3. Call `ask` once. One question per `chit-chat` thread ("Close thread <id>
   by <author>: '<gist>'?", options "Close" and "Keep open"). Then one final
   question: "Close the listed threads, merge, move the ticket, and update the
   vault?" with options "Go" and "Stop".
4. "Stop" → stop. Any chit-chat answered "Keep open" → that thread becomes
   `feedback`. Skip the merge and go to Step 3b.
5. "Go" and no "Keep open" → for every `superseded` thread and every
   chit-chat answered "Close", call `repo_pull_request_thread_write` action
   `update_status` with `status: "Closed"`. Re-`list` the threads and confirm
   each one has `status: 4`.
6. Re-`get` the PR and re-`list` the threads. Abort and report when
   `mergeStatus` is not `3`, any reviewer vote changed since the ask, or a
   new `feedback` thread appeared.
7. Arm auto-complete with `repo_pull_request_write` action `update`:

```json
{ "action": "update", "repositoryId": "<repo guid>", "pullRequestId": <pr_number>,
  "project": "<ADO_PROJECT>", "autoComplete": true, "mergeStrategy": "Squash",
  "deleteSourceBranch": true, "transitionWorkItems": false, "bypassPolicy": false }
```

- No MCP action sets `status: Completed`. Auto-complete with every blocking
  policy already `approved` merges at once. This is why Step 4 runs on fresh
  reads: auto-complete armed early merged PR #4567 unreviewed
  (`pr-creation` "Auto-complete safety").
- `transitionWorkItems: false`. Step 6 writes the move itself, once, with a
  revision test.
- Never set `mergeCommitMessage`. The ADO default `Merged PR <id>: <title>`
  matches `main` history in every repo (checked with `git log` on the bare
  repos, 2026-10-05).

Then re-`get` every 15 seconds, up to 4 times, until `status: 3`. Record
`lastMergeCommit.commitId` (the squash commit on `<target>`), `closedDate`,
and `closedBy.displayName`. Confirm the source branch is gone with
`repo_branch` action `get`, `branchName: <src>`; a not-found result is the
pass.

Still `status: 1` after 4 reads with `autoCompleteSetBy` set → the merge
waits on a policy. Name the cause. The Policies row was read → re-run the
`az` list and name every judged policy that is not `approved`. Otherwise name
every reviewer with `isRequired: true` and `vote: 0`, plus the latest PR
build. Then stop. The PR merges by itself when that policy passes. `/pr-merge`
re-run later routes a `status: 3` PR straight to Step 6.

## Step 6 — Move the work item one rung

For each id in `workItemRefs[]`: `wit_work_item` action `get` with `expand:
"Relations"`. Read `System.WorkItemType`, `System.State`, `System.Title`,
`rev`, and every relation with `rel: "ArtifactLink"` and `attributes.name:
"Pull Request"`. The PR id is the last segment of the URL
`vstfs:///Git/PullRequestId/{project}%2F{repo}%2F{prId}`. `get` every other
linked PR. "All merged" means every linked PR has `status: 3`.

Apply the table from `.omp/board-ingest/prompt.md` Step 7:

| Type | Current state | Evidence | Proposal |
|---|---|---|---|
| Bug | Ready for Fix | all merged | Resolved |
| Bug | New, Ready for Triage, Bug Test Failed, Blocked, Reopen | all merged | Resolved, and flag the unexpected source state |
| Bug | Resolved or later | any | none; Ready for Retest needs a QA deploy check |
| User Story | Backlog, In Refinement, Ready for Development, In Development | all merged | Ready for Test |
| User Story | Ready for Test or later | any | none; In Test needs a QA deploy check |
| any | any | some linked PRs still `status: 1` | none; report "N of M merged" |

Re-check that every linked PR has `status: 3`. Not all → skip the move and
report "N of M merged". The Step 5 "Go" already covers the move that Step 5
proposed, so ask nothing more. A PR already at `status: 3` in Step 1 had no
Step 5 ask. For a Bug moving to `Resolved` or a User Story moving to `Ready for Test`
with every linked PR at `status: 3`, ask nothing (RULES.md state exceptions)
and go straight to the write below. For any other move, show
`<id> <title>: <state> -> <proposed>` and ask first, then on approval proceed. Call `wit_work_item_write` action `update` with a `test` on
`/rev` carrying the
revision from the read, then `replace` on `/fields/System.State`. Re-`get`
and confirm `System.State` holds the new value. Never trust the update
call's own response. Never propose `Closed` or `Accepted`.

## Step 7 — Close the vault task page

Read `vault://wiki/schema.md` first. Find the page with
`vault://wiki/?op=search&q=path:tasks <ado id>`. No page → show the vote-5
suggestions in chat, say no task page exists, and skip to Step 8.

For every reviewer whose vote is `5`, collect the threads that reviewer opened
(first comment author) and that this run set to `Closed`. Any found → append
to the task page, under `## Notes`, this subsection. Write it whatever the
page `status` is:

```
### Review suggestions, PR <repo> #<pr_number>
- <reviewer display name>, thread <id> (<filePath:line> or "general"): <every comment content by that reviewer, verbatim, joined with " / ">
```

Then close the page as below. Drop the `; filed <n> review suggestions from
<names>` part of log bullet 3 when none were filed.

- `status: review` → set `status: done`, `completed: <today>`, and
  `ado_state` to the state confirmed in Step 6. Set `pr` to the PR URL when
  the field is `null`.
- Any other `status` → leave the page alone and say why.

Then read the last lines of `vault://wiki/log.md` and append after the final
entry:

```
## [YYYY-MM-DD] task | Completed PR <repo> #<pr_number>
- Merged <repo> #<pr_number> (<title>) into <target>, squash <sha>.
- Moved <ado id>: <old> -> <new>. | No move: <reason>.
- Closed [[tasks/<slug>]]; filed <n> review suggestions from <names>. | Left [[tasks/<slug>]] at <status>: <reason>.
```

## Step 8 — Report

PR URL (keep the `%20`), squash commit SHA, source branch deleted (yes/no),
approvers (display rules of Step 2: no vote numbers), policy lines at merge time, the thread ids this run closed, the
count of suggestions filed, the work item move result, the vault page
result, and the log line. State the next rung: run `post-merge` now (dev deploy check, tester
handoff). `Ready for Retest` (Bug) and `In Test` (Story) follow the QA deploy
check in `tasks-deployed-to-qa`, without a prompt. The task folder stays.
`task-cleanup` runs only when the user asks, and only after the user approves
its table. Its 7 days is a minimum folder age, not a schedule.

## Scan flow (no PR number)

1. List the active PRs with `skill://my-pr-status` Step 1 (six repos,
   `created_by_me: true`, `status: "Active"`).
2. Check the `az` session once, before the per-PR reads:
   `az account show -o none --only-show-errors`. A non-zero exit → offer the
   Step 2 read 5 login once (same id lookup, same ask). Declined or failed →
   every PR shows Policies `not read`, and this scan offers no further login.
3. For each PR, in parallel, run Step 1 and Step 2 of this skill read-only,
   policy read included. No Step 3 action, no write, no ask.
4. Give each PR one verdict: `eligible` (every row passes, no chit-chat
   thread), `eligible after your call` (only chit-chat threads remain), or
   `blocked: <first failing gate>` in Step 3 order. A failing Policies row
   gives `blocked: policy <displayName>`.
5. Show one table: `#id`, repo, short title, ticket, verdict, threads to
   close.
6. No PR is `eligible` or `eligible after your call` → stop.
7. Otherwise call `ask` once with `multi: true` and one option per such PR
   (label `#<id> <repo>`, description = the verdict). No pick → stop.
8. For each picked PR, in the order picked, run the single-PR flow from Step 1
   with fresh reads. Each PR gets its own Step 5 ask. The `az` session check
   from item 2 carries over. Do not offer the login again.

## Boundaries

- Own PRs only. Never edit, push, or merge a branch by another author.
- Never set `bypassPolicy`. Never arm auto-complete before Step 4 passes on
  fresh reads. Never vote on the PR.
- Never set `mergeCommitMessage`.
- Never move a work item to `Closed` or `Accepted`.
- Slack: DMs only, drafted in chat, posted on "send it". Never a channel
  post from this skill.
- No git command of its own. `merge-conflict` and `pr-comments`
  own every git call, each behind its own approval.
- Never delete the task folder or its worktrees.
- Scan flow never writes before the user picks a PR. Never merge a PR the
  user did not name or pick.
- Close threads only by the `superseded` rule or a chit-chat "Close" answer.
  This is the one exception the `pr-thread-resolution` rule names.
- Re-queue a stale PR build only as "Re-queue a stale build" states. Never
  queue a build for a PR that is not the one being merged.

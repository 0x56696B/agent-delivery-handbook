---
name: pr-comments
description: Use when a pull request on the platform has review comments and the user passes its number — takes a PR number as its only input and discovers the PR's repo the same way merge-conflict does. On the user's own PR it resolves the open reviewer threads in the task folder its branch was worked in — reproduces each finding before fixing it, runs the repo checks, keeps one commit per repo, and stops for approval before the push and before every thread reply. On someone else's PR that already carries the user's own comments, it checks those threads for replies and writes a verification handoff doc in the PR-REVIEW task folder; it never touches the branch.
---

# Resolving a PR's review comments

This skill has two modes, chosen by the PR author in Step 1. Author mode resolves
the open comment threads on the user's own PR. Reviewer mode checks the user's
own comments on someone else's PR for replies and writes a handoff doc. Neither
mode moves a ticket or posts to Slack.

## Input

`pr_number` only. The repo
and the task folder are discovered here, never supplied by the invoker.

## Step 1 — Find the PR, then gate

Read `skill://merge-conflict`. Run its Step 1 (find the PR across the six
repos) exactly as written.

Then stop and report, running no git command and no script, when `status` is
not `1` (Active).

`mergeStatus` is not a gate here. A PR with a conflict and open comments gets
`/conflict` first, then this skill.

Then choose the mode from `createdBy.uniqueName`:

- `<YOUR_EMAIL>` → **author mode**. Run that skill's Step 3 and
  3b (find or create the task folder) and Step 4 (sync the worktree), then
  Steps 2 to 9 below. `<folder>`, `<repo>`, `<src>`, `<target>`, and `<ABS>`
  carry the same meaning as in that skill.
- anyone else → **reviewer mode**. The branch belongs to that person. Never
  edit, commit, or push on it. Run no git command except the read-only wiring
  in Step R2. Go to "Reviewer mode" after Step 9. Steps 2 to 9 do not run.

## Step 2 — Read every thread verbatim

Call `repo_pull_request_thread` action `list` with `repositoryId: <repo>`,
`pullRequestId`, `project: "<ADO_PROJECT>"`, `fullResponse: true`.

Enum values (source: `microsoft/azure-devops-node-api`,
`api/interfaces/GitInterfaces.ts`, verified 2026-10-05):

| `status` | Name | | `commentType` | Name |
|---|---|---|---|---|
| 0 | Unknown | | 0 | Unknown |
| 1 | Active | | 1 | Text |
| 2 | Fixed | | 2 | CodeChange |
| 3 | WontFix | | 3 | System |
| 4 | Closed | | | |
| 5 | ByDesign | | | |
| 6 | Pending | | | |

A thread is **in scope** when all of these hold:

- Its first comment has `commentType: 1` and `isDeleted` is not `true`.
  System threads ("Policy status has been updated", vote and reviewer
  events) have `commentType: 3`. Skip them.
- `status` is `1`, `6`, or absent. `2`, `3`, `4`, and `5` are resolved.
- The last non-deleted comment is not by `<YOUR_EMAIL>`. A
  thread that already ends with the author's reply waits on the reviewer.

A thread with no `threadContext` is a general PR comment. It is in scope on
the same rules. Never drop it for lacking a file anchor.

For each in-scope thread capture `id`, `threadContext.filePath`,
`threadContext.rightFileStart.line` and `rightFileEnd.line`, the author
display name of every comment, and every comment `content` verbatim.

No in-scope thread → report "no open comments" with the counts of skipped
system and resolved threads, and stop.

`mkdir -p <ABS>/comments`. Write `<ABS>/comments/THREADS.md`: one section per
thread, in thread id order, with the fields above. Every later file this
skill writes goes in the same directory.

## Step 3 — Classify, then show the plan

Re-read the current worktree at every cited `filePath` and line before you
classify. The comment may describe a state the branch no longer has.

One of four classes per thread:

| Class | Meaning | What this skill does |
|---|---|---|
| `fix` | The finding is real and belongs in this PR | Reproduce, fix, verify, reply, leave Active |
| `answer` | A question, or a claim the code already refutes | Reply with file:line evidence, leave Active |
| `disagree` | The finding is real but the proposed change is wrong | Reply with the reasoning, leave Active |
| `defer` | The finding is real but outside the PR's scope | File a Bug via `pr-and-team-comms`, reply with its number, leave Active |

Show the table in chat: thread id, file:line, reviewer, one-line gist, class,
and the intended change or reply in one line each. Ask once. Proceed only
after the user approves the table. The user may reclass any row.

## Step 4 — Resolve each `fix` thread

Treat each one as a bug. Rule `BUG_FIXING` applies.

1. **Reproduce first.** Prove the finding at its true failure boundary before
   editing: a failing test, a script, an HTTP call against the running
   service, or a browser flow. A finding that does not reproduce is not a
   `fix`. Reclass it `answer` and return to Step 3 for that row.
2. Fix the source. Never special-case the reviewer's example input.
3. Prove the reproduction no longer triggers. Keep the reproduction as a
   regression test when it defends an observable contract. A throwaway
   script is enough when it does not.
4. Record the evidence in `<ABS>/comments/THREAD-<id>.md`: the finding, the
   reproduction command and its output before the fix, the change, and the
   same command's output after.

A live check that needs a running service follows
`skill://service-startup-reference`. Check the port with `lsof` first.

## Step 5 — Run the repo checks

Run the documented checks for `<repo>`. The section "PR-build checks per repo" in `service-startup-reference` lists them. Read the repo `README.md` when in doubt.

A failing check may already fail on `<target>`. Prove which it is with the
scratch worktree from the same step, then remove the worktree.

Search every edited file with the `grep` tool for `^(<<<<<<<|=======|>>>>>>>)`
and for `TODO|FIXME|XXX`. Any new hit is unfinished work.

## Step 6 — Commit

Write the commit message to a file with the `write` tool and pass it with
`git commit -F <file>`. A heredoc inside `-m` gets mangled by shell quoting.

Choose the shape by counting the PR's own commits:

```bash
git -C <folder>/<repo> rev-list --count refs/remotes/origin/<target>..HEAD
```

- `1` → the PR is one commit. Amend it: `git commit --amend -F <file>`. The
  push in Step 7 then needs `--force-with-lease`.
- more than `1` → the branch already carries a merge commit from `/conflict`,
  or earlier review rounds. Never amend a merge commit. Add one commit:
  `git commit -F <file>`. The push is a plain push.

The commit message states what changed and why, in the PR-description voice
from `skill://pr-creation`. Never write "address review comments".

Every edit from Step 4 goes in that single commit, across all threads.

## Step 7 — Push, after the user approves

Run `pr-security-gate` with base `origin/<src>`; include its result in
the report. Then report per thread: class, the change, the reproduction
before and after, and the check results. Report the commit SHA and the push
shape from Step 6. Ask before pushing. On approval:

```bash
git push origin HEAD:refs/heads/<src>                     # added commit
git push --force-with-lease origin HEAD:refs/heads/<src>  # amended commit
```

`--force-with-lease` only on your own branch, only in the amend case, and
only after the Step 1 sync proved local and `origin/<src>` were equal. A
lease rejection means someone pushed while this ran. Re-run from Step 1.

Re-`get` the PR. `lastMergeSourceCommit.commitId` must equal the pushed SHA.
`mergeStatus: 1` is expected at first. Re-`get` after 15 seconds, up to 4
times, until it reads `3`. Any other value → report it and stop. A `2` means
the fix now conflicts with `<target>`; run `/conflict` next.

## Step 8 — Reply in each thread, after the user approves

Draft every reply in chat first, each in its own fenced code block with its
thread id. The reply posts under the user's identity, so write in the user's
voice. Each reply:

- cites `file:line` on the pushed commit, and the commit SHA for a `fix`
- names the Bug number for a `defer`
- never says "addressed", "done", or "fixed as requested" without the
  evidence line next to it

Ask once for the whole set. On approval, post each reply as
`skill://pr-and-team-comms` "Responding to review comments" states:
same thread, existing `threadId`, then re-`list` and confirm the reply landed.
That section owns the reply mechanics. This skill adds only the status rule:

- All four classes (`fix`, `answer`, `disagree`, `defer`) stay `Active` after
  the reply. Rule `pr-thread-resolution` forbids `Fixed` on another
  person's thread. The reviewer closes it.

## Step 9 — Report

Per thread: id, class, final status, reply posted (yes/no). The commit SHA,
the push shape, the final `mergeStatus`, and the PR URL. Threads left `Active`
are the reviewer's turn; say so.

## Reviewer mode — your comments on someone else's PR

Reached from Step 1 when the PR author is not `<YOUR_EMAIL>`.
This mode does not judge whether a comment was addressed. It collects what the
author did, and writes a handoff doc for the session that verifies it.

### Step R1 — Find your threads and the responses to them

Call `repo_pull_request_thread` action `list` with `repositoryId: <repo>`,
`pullRequestId`, `project: "<ADO_PROJECT>"`, `fullResponse: true`. Use the
`status` and `commentType` tables from Step 2.

A thread is **yours** when its first non-deleted comment has `commentType: 1`
and its author `uniqueName` is `<YOUR_EMAIL>`. Skip system
threads. Keep your threads in every status, including `2` to `5`.

No thread of yours → report "PR <pr_number> has no comments by you" and stop.
Create no folder and run no script.

For each of your threads capture `id`, `status`, `threadContext.filePath`,
`rightFileStart.line` and `rightFileEnd.line` (use the `leftFile` pair when
only that exists), the iteration context when present, and for every
non-deleted comment the author display name, `uniqueName`, `publishedDate`, and
`content` verbatim.

Mark each thread with one response state:

| State | Rule |
|---|---|
| `replied` | A non-deleted comment by someone other than you follows your first comment |
| `status-only` | No reply, but `status` is `2`, `3`, `4`, or `5` |
| `silent` | No reply and `status` is `1`, `6`, or absent |

Also record, per thread, whether the last non-deleted comment is yours. That
means you already answered the reply, and the thread waits on the author.

Continue to Step R2 for every PR that has a thread of yours. The stop decision
comes after R2, because it needs the commit list.

### Step R2 — Wire a read-only worktree

The verifier needs the current code. Follow `skill://pr-review` Step 3
exactly: reuse an existing `PR-REVIEW-<pr_number>-*` folder in
`~/work/<PROJECT>/tasks`, or run
`./setup-task-branch.sh --pr <repo> --target-branch <target> <src>
PR-REVIEW-<pr_number>-<summary>` from that directory. Then
`mkdir -p <ABS>/review`, where `<ABS>` is the absolute path of that folder.

Check the worktree head equals the PR's `lastMergeSourceCommit.commitId`. If it
does not, the branch moved; re-run the script. Never edit, commit, or push in
the worktree.

Then count the commits pushed after each of your threads. For each thread run
`git -C <folder>/<repo> log --format='%h %cI %s' --since=<publishedDate of your
first comment> refs/remotes/origin/<src>` and keep the list. An author often
pushes a fix and never replies, so a `silent` thread can still have a change.

Stop and report only when every thread is `silent` and no thread has a commit
after it. Report the thread count, the PR URL, and that no reply or later
commit exists. Write no doc. The worktree stays as wired.

### Step R3 — Write the handoff doc

Write `<ABS>/review/VERIFY-HANDOFF.md`. It is a snapshot of ADO state. A re-run
overwrites it. It must let a new session verify with no re-fetch from ADO.

1. **Header** — PR number and URL, repo, title, author display name,
   `<src>` → `<target>`, the head SHA, the generation date, the worktree path
   `<folder>/<repo>`, and the linked work item id and title when present.
2. **Summary table** — thread id, anchor (`file:line`), thread `status`
   name, response state, the count of commits after your comment, and whether
   the last comment is yours.
3. **One section per thread**, in thread id order:
   - Anchor as `file:line` at comment time. State that lines may have moved
     since, and that the verifier must locate the code by content.
   - Your original comment, verbatim.
   - Every reply, verbatim, in order, with author and date.
   - The commits pushed after your comment, from Step R2: hash, date, subject.
   - **Claimed resolution** — one line: what the author says they did, or
     "none stated".
   - **To verify** — the concrete check taken from your comment and the
     replies: the file, the symbol or behavior, and the observable condition
     that would show your finding is resolved.
4. **Verification protocol** for the receiving session:
   - Re-`get` the PR first. When `lastMergeSourceCommit.commitId` differs from
     the header SHA, the branch moved; re-run `/comments <pr_number>`.
   - For each thread, read the code at the head SHA, locate it by content, and
     compare it with the claim. Use
     `git -C <worktree> diff origin/<target>...HEAD > <ABS>/review/diff.patch`
     (absolute path) when the whole change is needed.
   - When your comment asserted a bug, reproduce it at its true failure
     boundary on the head SHA. Rule `BUG_FIXING` applies. A reply without a
     code change does not resolve a bug.
   - Give each thread one verdict: `addressed`, `partly addressed`, `not
     addressed`, `answered without a change`, or `cannot tell`. Cite
     `file:line` at the head SHA for every verdict.
   - Recommend one next action per thread: set `Fixed` or `Closed`, reply with
     the remaining gap, or leave it. These threads are yours, so rule
     `pr-thread-resolution` allows a status change. Post nothing and
     change no status without the user's approval.

### Step R4 — Report

In chat: the PR URL, counts per response state, the doc path, the head SHA,
and the ids of `silent` threads. State that nothing was posted and no status
changed.

## Boundaries

- Never move the work item state, comment on the work item, vote on the PR,
  complete the PR, arm auto-complete, or post to Slack.
- Author mode: never push, reply, or change a thread status before the user
  approves that step. Code edits inside the worktree need no approval.
- Reviewer mode: never reply in a thread, change a thread status, or vote.
  The only write is the handoff doc.
- Never run git against a PR branch another person opened, except the
  read-only wiring in Step R2. Never edit, commit, or push on that branch.
- Never `--force`. `--force-with-lease` only as Step 7 states.
- Author mode writes only under `<task folder>/comments/`. Reviewer mode
  writes only under `PR-REVIEW-<pr_number>-<summary>/review/`. Nothing lands at
  the `~/work/<PROJECT>/tasks` root.
- No vault write. The review-status entry on the task page belongs to
  `pr-and-team-comms`; run it when the user asks.

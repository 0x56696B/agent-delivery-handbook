---
name: morning-brief
description: Use when the user asks what to work on today, asks to work the morning brief, or asks to close the tickets whose pull requests have merged. Reads the vault morning brief the board-ingest cron wrote, then applies the proposed Azure DevOps state moves and vault task closes after one approval.
---

## Input

None. The invoker is the current user.

## Step 1 — Read the brief

Read `vault://wiki/notes/morning-brief.md`. When its `date`
frontmatter is not today, say so and re-derive the "Ready to close" list
live, using `board-ingest/prompt.md` steps 5 to 7. Never act on a stale
list without saying it is stale.

## Step 2 — Present the list

Show every "Ready to close" row as:

    <id> <title>: <current state> -> <proposed state>, PR <repo> #<id> merged

Name the vault task page for each. Then ask for one approval covering
the whole list, and accept a subset.

## Step 3 — Apply the Azure DevOps move

For each approved row, call `wit_work_item` action `update` with a
`test` operation on `/rev` carrying the revision from the read, then a
`replace` on `/fields/System.State`. The `/rev` test gives optimistic
concurrency; Azure DevOps rejects the whole update when the revision
moved.

## Step 4 — Confirm the write

Re-fetch each item with `wit_work_item` action `get` and check
`System.State` really holds the new value. Never trust the update
call's own response. Report any item that did not move.

## Step 5 — Close the vault task

For each item that moved, and whose task page has `status: review`, set
`status: done` and `completed` to today's date. This matches
`wiki-sync` "Close reviewed tasks". Leave a page in any other status alone and say why.

## Step 6 — Append the log entry

Read the last lines of `vault://wiki/log.md`, then append:

    ## [YYYY-MM-DD] task | Morning brief close pass
    - Moved <n> Azure DevOps item(s): <id> <old> -> <new>, ...
    - Closed <n> vault task(s): [[tasks/<slug>]], ...
    - Skipped <n>: <reason per item>.

## Optional — QA deploy check

When the user asks about a "Needs QA deploy check" row, follow
`tasks-deployed-to-qa` for that item, then write `Ready for
Retest` for a Bug or `In Test` for a User Story, without a prompt, only
after the `git merge-base --is-ancestor` check passes (RULES.md state
exceptions). Re-fetch and confirm.

## Optional — Post-merge handoff

For any own PR the brief shows as merged with no `## Post-merge` line on its
vault task page, offer to run `post-merge` (dev deploy check, dev
evidence, tester handoff document, ticket comment draft). Run it only when
the user picks it.

## Boundaries

- Never move an item to `Closed` or `Accepted`; a retest result and a
  product owner decision are human calls.
- Never post to Slack.
- Never create or complete a pull request.
- Ask again before any move the brief did not propose.

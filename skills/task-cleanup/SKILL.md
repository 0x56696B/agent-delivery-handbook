---
name: task-cleanup
description: Use when the user asks to clean up, prune, or tidy ~/work/<PROJECT>/tasks — covers reporting every task folder's git and PR state, deciding which finished folders are safe to delete, archiving their markdown artefacts, removing the per-repo worktrees and local branches, and clearing approved loose files from the tasks root.
---

## Step 1 — Preconditions

Run this skill from `~/work/<PROJECT>/tasks`. If `pwd` is anywhere else, stop and
say so. The Azure DevOps and Slack MCP servers load from `<cwd>/.omp` only.

## Step 2 — Report

Run `./cleanup-task-folders.sh report`. This step is read-only. Parse the
TSV into four record kinds: `FOLDER`, `REPO` (linked to a folder by name),
`STRAY`, and `ORPHAN`, plus the trailing `SUMMARY` line.

## Step 3 — Resolve merge state

For every `REPO` record with `unique_commits > 0`, call `repo_pull_request`
action `list` with `project: "<ADO_PROJECT>"`, `repositoryId: <repo>`,
`sourceRefName: "refs/heads/<branch>"`, `status: "All"`. Run these calls in
parallel, one per distinct repo+branch pair. Record the highest-precedence
PR status per pair: Active (1) beats Completed (3) beats Abandoned (2)
beats no PR found.

## Step 4 — Resolve ticket state

Take `<TYPE>-<ID>` from the folder name.

- `PR-REVIEW-<id>` and `PR-<id>` folders: the id is a PR id. Call
  `repo_pull_request` action `get` for the repo the folder links, and treat
  Completed or Abandoned as finished.
- `RESEARCH-00000-*` and `SANDBOX-00000-*` folders: no ticket. Skip this
  step.
- Every other folder: call `wit_work_item` action `get` with
  `fields: ["System.State"]`.

## Step 5 — Classify each folder

- **CLEAN** — every repo with `unique_commits > 0` has a Completed or
  Abandoned PR, no repo is `dirty:*`, `ahead:*`, or `diverged`,
  `age_days >= 7`, and the ticket state is one of `Resolved`,
  `Ready for Retest`, `Closed`, `Cancelled`, `Duplicate`, `Deffered` (or the
  folder has no ticket).
- **CLEAN (unused)** — no repo has `unique_commits > 0`, meaning the folder
  was bootstrapped but never used. The ticket state does not matter.
- **KEEP** — anything else. Give the single strongest reason: an active PR,
  an open ticket state (`New`, `Ready for Triage`, `Ready for Fix`,
  `Blocked`, `Bug Test Failed`, `Reopen`), unpushed commits (`ahead:*`,
  `diverged`, or commits with no PR), a dirty worktree, or age under 7 days.

## Step 6 — Show one table and ask once

Columns: folder, age, size, verdict, reason. List the orphan worktrees and
the root strays underneath it. Ask for approval in one question, and let
the user drop individual rows. Do not act before the user approves.
Deleting work is destructive and `RULES.md` requires the ask.

## Step 7 — Apply in this order

1. `./cleanup-task-folders.sh clean --apply <approved folders...>`
2. `./cleanup-task-folders.sh clean-worktree --apply <approved orphans...>`
3. `./cleanup-task-folders.sh strays --apply <approved names...>`
4. `./cleanup-task-folders.sh prune --apply`

Report each subcommand's own output. Never pass `--force` unless the user
names the folder and accepts the loss.

## Step 8 — Close out

Report the total `size_kb` freed and the archive paths. State which folders
were kept, and why, in one line each.

## Boundaries

- Read-only until the user approves. The report step never changes
  anything.
- Never delete a remote branch, never push, never complete or abandon a
  PR, never change a work-item state from this skill.
- Never touch the `main`, `master`, or `fix-asd` worktrees, a bare repo
  root, or any keep-list entry.
- Never clean the folder the session started in.
- `--force` needs an explicit user instruction naming the folder.

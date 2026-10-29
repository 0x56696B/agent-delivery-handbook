---
name: merge-conflict
description: Use when a pull request on the platform has merge conflicts and the conflict must be resolved in the task folder its branch was worked in — takes a PR number as its only input, discovers the PR's repo across the six in-scope repos, finds the task folder by symlink target, merges the target branch into the PR branch (never rebases, never force-pushes), regenerates lockfiles instead of hand-merging them, proves the PR's own change survived, and stops for approval before the push.
---

# Resolving a PR's merge conflict

This skill resolves one conflict and nothing else. It never moves a ticket, and
it never comments anywhere.

## Input

`pr_number` only. The repo
and the task folder are discovered here, never supplied by the invoker.

## Step 1 — Find the PR and its repo

Call MCP `repo_pull_request` action `get` once per repo, all six in parallel,
each with `project: "<ADO_PROJECT>"`, `pullRequestId: <pr_number>`,
`includeWorkItemRefs: true`, and `repositoryId` set to the plain repo name:

`orchestrator`, `data-mcp`, `media-mcp`,
`file-gateway`, `web-app`, `infra`.

The owning repo returns a populated object. Every other repo returns `{}` — an
empty object, not an error (verified 2026-09-24: PR 4567 fetched with
`repositoryId: "data-mcp"` returned `{}`). All six empty → report that
the PR is not in the six in-scope repos, and stop.

Capture `repository.name`, `sourceRefName`, `targetRefName`, `mergeStatus`,
`status`, `createdBy.uniqueName`, `lastMergeSourceCommit.commitId`,
`workItemRefs[0].id`, `title`, and the PR web URL. Strip the `refs/heads/`
prefix from both branch names. `<src>` and `<target>` below mean the stripped
names.

## Step 2 — Gates, before any git command

`mergeStatus` values (source: `microsoft/azure-devops-node-api`,
`api/interfaces/GitInterfaces.ts`, enum `PullRequestAsyncStatus`):

| Value | Name | Meaning |
|---|---|---|
| 0 | notSet | Status is not set |
| 1 | queued | Merge is queued |
| 2 | conflicts | Merge failed on conflicts |
| 3 | succeeded | Merge succeeded |
| 4 | rejectedByPolicy | Merge rejected by policy |
| 5 | failure | Merge failed |

Stop and report, running no git command, when any of these holds:

- `status` is not `1` (Active).
- `createdBy.uniqueName` is not `<YOUR_EMAIL>`. Report the repo,
  `<src>`, `<target>`, the author's display name, and the PR URL. State that
  the branch belongs to that person. Never fetch, merge, or push on it.
- `mergeStatus` is `3`: there is no conflict. Report and stop.
- `mergeStatus` is `0`, `4`, or `5`: report the value and its name. `4` is a
  policy rejection, not a conflict.

`mergeStatus` `1` means ADO has not finished computing the merge: re-`get`
after 15 seconds, up to 3 times. Still `1` → report and stop.

Only `mergeStatus: 2` continues to Step 3.

## Step 3 — Find the task folder the branch was worked in

A task-folder symlink target carries the branch, e.g.
`BUG-12345-sparse-slide-content/media-mcp` →
`../../media-mcp-bare/fix/sparse-slide-content`. Match on that, from
`~/work/<PROJECT>/tasks`:

```bash
REPO=<repo>; SRC=<src>
for link in */"$REPO" archive/*/"$REPO"; do
  [ -L "$link" ] || continue
  t=$(readlink "$link")
  [ "${t%/$SRC}" = "$t" ] && continue
  [ "$(basename "${t%/$SRC}")" = "$REPO-bare" ] || continue
  printf '%s\n' "${link%/$REPO}"
done
```

The `${t%/$SRC}` strip plus the `basename` check are both required. A plain
`*/$SRC` glob also matches `hotfix/x` when `$SRC` is `fix/x`.

- Exactly one hit → that is the task folder. A hit under `archive/` counts. Use
  it in place, and say so in the report.
- More than one hit → stop, list them, and let the user pick.
- No hit → Step 3b.

## Step 3b — No folder for that branch

First check for a folder that belongs to the PR's ticket but holds a different
branch: with a `workItemRefs[0].id`, glob `BUG-<id>-*` and `STORY-<id>-*`. If
one exists and its `<repo>` symlink points at another branch, stop and report
both branch names. Never replace that symlink. Another task may be in flight in
it.

Otherwise create the folder. Derive the name:

- Work item present → `wit_work_item` action `get`, read
  `System.WorkItemType`. `Bug` → `BUG`, `User Story` → `STORY`. Folder is
  `{TYPE}-{id}-{summary}`.
- No work item → `PR-{pr_number}-{summary}` (precedent:
  `archive/PR-4567-settings-env-fail-closed`).
- `{summary}` is `<src>` with its `type/` prefix removed, e.g.
  `fix/sparse-slide-content` → `sparse-slide-content`.

From `~/work/<PROJECT>/tasks`:

```bash
./setup-task-branch.sh --pr <repo> --target-branch <target> <src> <folder>
```

The script creates the folder itself. Never create it first. `--pr` mode wires
only that one repo and makes **no** `.env` symlink. If a check in Step 7 needs
`.env`, run
`ln -s ../../.env <repo>-bare/<src>/.env` (one `../` per `/` in `<src>`, plus
one). A bash command that touches a `.env` path needs no confirm: the
`guardrails` extension masks dotenv values as `*****` and prompts only to
overwrite an unmanaged dotenv file.

## Step 4 — Sync the worktree

Work through the task folder symlink, `<folder>/<repo>`. Every git call takes
`git -C <folder>/<repo>`.

1. `git status --porcelain` — non-empty → stop and report the dirty paths.
2. `git rev-parse --abbrev-ref HEAD` must equal `<src>`. Otherwise stop.
3. These bare clones carry no `remote.origin.fetch`, and the branches have no
   upstream config (verified on `web-app-bare`: `git config --get-all
   remote.origin.fetch` and `git config --get-all branch.<name>.merge` both
   return nothing). A bare `git fetch origin` updates nothing. Use explicit
   refspecs:

   ```bash
   git fetch origin \
     "+refs/heads/<target>:refs/remotes/origin/<target>" \
     "+refs/heads/<src>:refs/remotes/origin/<src>"
   ```

4. Compare `git rev-parse HEAD` with `git rev-parse refs/remotes/origin/<src>`
   and with the PR's `lastMergeSourceCommit.commitId`:
   - all equal → continue.
   - local is an ancestor of origin (`git merge-base --is-ancestor HEAD
     refs/remotes/origin/<src>`) → run `git merge --ff-only
     refs/remotes/origin/<src>`, then continue.
   - anything else (ahead, or diverged) → stop and print all three SHAs.

## Step 5 — Capture the pre-merge diff

`mkdir -p <ABS>/conflict`, where `<ABS>` is the absolute path of the task
folder. Then, with `git -C`:

```bash
git diff refs/remotes/origin/<target>...HEAD > <ABS>/conflict/pre-merge.patch
```

Three dots: this is the PR's own change from the old merge base. The output
path must be absolute. A shell redirect inside the worktree resolves the
task-folder symlink physically and lands inside the bare repo (recorded in
`pr-review` Step 4).

## Step 6 — Merge the target in and resolve

```bash
git merge --no-ff refs/remotes/origin/<target>
```

Expect a non-zero exit. List the conflicts with
`git diff --name-only --diff-filter=U`.

In this merge, `--ours` is the PR branch and `--theirs` is `origin/<target>`.
That is the opposite of a rebase. Never rebase this branch.

Resolution rules:

- Read both sides of every hunk and keep both intents. Take one whole side only
  when the other side deleted the file, or when both sides are byte-identical.
- Never leave a conflict marker. Run `git add <file>` after each file.
- Lockfiles are never hand-merged. `web-app` uses `pnpm-lock.yaml`.
  `orchestrator`, `data-mcp`, `media-mcp`, and
  `file-gateway` use `uv.lock`. Resolve the manifest (`package.json` or
  `pyproject.toml`) first, then `git checkout --theirs <lockfile>`, then
  regenerate: `pnpm install --lockfile-only` for `web-app`, `uv lock` for
  a Python repo. Then `git add <lockfile>`. Tooling on this workstation: pnpm
  10.32.1, uv 0.12.5.
- A file the target moved or renamed: keep the target's structure, and reapply
  the PR's intent at the new location. Record that in the notes.
- A test file both sides touched: re-read the merged test. It must still assert
  the PR's behavior, not a half-merged mix.

Commit the merge with git's default message. The later squash merge discards
it:

```bash
git -c core.editor=true merge --continue
```

## Step 7 — Prove nothing was lost, then check the repo

```bash
git diff refs/remotes/origin/<target>..HEAD > <ABS>/conflict/post-merge.patch
diff <ABS>/conflict/pre-merge.patch <ABS>/conflict/post-merge.patch
```

Two dots in the second diff: after the merge, it is the PR's net effect over
the target. Read every line the two patches differ by, and explain each one. A
hunk of the PR's own change that disappeared is a bad resolution. Go back to
Step 6.

Search the merged files with the `grep` tool for `^(<<<<<<<|=======|>>>>>>>)`.
Any hit is unfinished work.

Run the repo's PR-build checks from `service-startup-reference`, section
"PR-build checks per repo". Every command must pass before the push.

A failing check may already fail on the target. Prove which it is: add a
scratch worktree on the target, run the same check there, then remove it.

```bash
git worktree add --detach /tmp/conflict-base-<pr_number> refs/remotes/origin/<target>
# run the same check in /tmp/conflict-base-<pr_number>
git worktree remove /tmp/conflict-base-<pr_number>
```

Write `<ABS>/conflict/CONFLICT-NOTES.md`: PR number and URL, repo, `<src>` and
`<target>`, the merge commit SHA, one line per conflicted file (what each side
wanted, what the resolution keeps), the explanation of every pre/post patch
difference, and the check results, including the scratch-worktree comparison
when one was needed.

## Step 8 — Push, after the user approves

Report the conflicted files, the resolutions, the patch comparison, and the
check results. Ask before pushing. On approval:

```bash
git push origin HEAD:refs/heads/<src>
```

Plain push. Never `--force`, never `--force-with-lease`: the merge only adds a
commit. A non-fast-forward rejection means someone pushed while this ran.
Re-run from Step 4.

## Step 9 — Confirm the conflict is gone

Re-`get` the PR. ADO recomputes the merge asynchronously, so `mergeStatus: 1`
(queued) is expected at first. Re-`get` after 15 seconds, up to 4 times, until
it reads `3`. Report the final value, the merge commit SHA, and the PR URL.

## Boundaries

- Never move the work item state, comment on the work item, comment on the PR,
  complete the PR, arm auto-complete, or post to Slack. This skill resolves a
  conflict and nothing else.
- Never force-push. Never rebase the branch.
- Never run git against a PR branch another person opened.
- Every file this skill writes goes under `<task folder>/conflict/`. Nothing
  lands at the `~/work/<PROJECT>/tasks` root.
- No vault write.

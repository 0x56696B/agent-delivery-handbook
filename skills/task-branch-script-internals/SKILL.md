---
name: task-branch-script-internals
description: Use when fixing a bug in ~/work/<PROJECT>/tasks/setup-task-branch.sh itself, or when its exact directory/idempotency/fetch behavior needs to be understood beyond "just run it" — covers the fetch-refspec gotcha for branching off the true latest upstream default branch, stale-worktree-registration recovery, and safe local testing without touching the real repos.
---

For everyday invocation of the script, see `ticket-bootstrap` — this skill
is for changing the script or debugging its behavior.

## Design decisions already made (don't re-litigate silently)

- **`.env` mode is a relative symlink, not a copy.** Each branch worktree gets
  a symlink back to the bare repo's root `.env`, so every branch worktree of
  that repo shares one `.env` and an edit at the bare root reaches all of
  them. `--pr` mode links none. The `../` depth equals the number of `/`
  segments in `branch_name` (a worktree at `<bare>/fix/bug-123/` needs
  `../../.env`; `<bare>/main/` needs `../.env`); the script computes it with
  its `relpath` helper, not by hand. A change to copy mode is a real
  behavioral fork: ask the user explicitly before making it.
- **Branch base is always latest `main`**, not whatever stale local ref the
  bare clone has cached. Don't skip fetching.
- **Excluded repos are skipped before any git work, not cleaned up after.**
  `excluded_repos` (near the top of the script, currently `legacy-agent`) is
  checked right after computing `repo_name`, in default mode only (not
  `--pr` mode, which targets one named repo explicitly). A match logs one
  line and `continue`s before fetch, worktree, `.env`, or symlink work runs.
  Adding a new standing exclusion means adding its name to that array, not
  teaching a skill to remove the symlink afterward.
- **The duplicate-folder guard globs the family, not the exact name.** Before
  `mkdir -p`, the script checks the target's parent directory for an existing
  `<TYPE>-<ID>-*` folder under a different summary slug and refuses to create
  a second one for the same ticket. It matches on the `<TYPE>-<ID>-` prefix
  (glob), not a full-string compare against `target_dir` — a full-string
  compare would miss a duplicate that only renamed the summary. The
  ticketless `00000` family is exempt, since every research folder shares
  that placeholder ID; each such folder's summary, not the ID, is its real
  identity. If you touch this, keep the ID anchored to the FIRST run of
  digits after the letters/dashes prefix — a greedy match to the LAST digit
  run would let a numeric token inside the summary itself (e.g.
  `PR-REVIEW-4567-fix-bug-12345-regression`) steal the match.
  

## The fetch-refspec gotcha

`git clone --bare` often leaves `remote.origin.fetch` **unset** (verify with a
`read` of the bare repo's `config` file — don't assume). Under that condition:

- Plain `git fetch origin` only updates `FETCH_HEAD`; `refs/remotes/origin/*`
  is never created or updated.
- Fix: fetch with an **explicit refspec**:
  `git --git-dir=<bare> fetch --quiet origin "+refs/heads/<base>:refs/remotes/origin/<base>"`,
  then use `refs/remotes/origin/<base>` as the worktree-add base instead of
  the local `<base>` ref.
- Do NOT fast-forward the local `refs/heads/<base>` ref directly — it is very
  likely already checked out in an existing worktree (e.g. `<bare>/main`), and
  git will refuse or risk conflicts updating a ref checked out elsewhere.
  Fetching into the separate `refs/remotes/origin/<base>` namespace sidesteps
  this entirely.
- On fetch failure (offline, etc.), fall back to the local ref and say so
  explicitly in the log — don't fail the whole repo over a network hiccup.

## The stale-worktree-registration gotcha

`git worktree list --porcelain` can report a worktree as registered even after
its directory was deleted by hand (e.g. `rm -rf`). If the script trusts that
registration blindly and skips `worktree add`, a later `cd "$worktree_path"`
fails. Under `set -uo pipefail` (no `-e`), this is silent: the captured path
variable becomes empty, downstream symlinks point at garbage, and the repo is
still counted a success.

Fix — before trusting a "registered" worktree, also check the directory
actually exists:

```bash
if $worktree_registered && [[ ! -d "$worktree_path" ]]; then
  git --git-dir="$bare_dir" worktree prune
  worktree_registered=false
fi
```

Then fall through to the normal "not registered" branch: `worktree add <path>
<branch>` if the branch ref already exists (recreates the checkout), or
`worktree add -b <branch> <path> <base>` if it's genuinely new.

## Testing changes without corrupting real repos

- Never test against the real `*-bare` repos directly — build a disposable
  `mktemp -d` sandbox with a fake `origin` repo plus `git clone --bare`, and
  strip the fetch refspec to match production:
  `git --git-dir=<bare> config --unset-all remote.origin.fetch`.
- A bash command that touches a `.env` path (even a synthetic one under
  `/tmp`) needs no confirm. The `guardrails` extension allows dotenv reads
  with values masked as `*****`, blocks writing the mask back, and prompts
  only to overwrite an unmanaged dotenv file. Inspect a synthetic `.env`
  link with `readlink`, not by reading its value.
- Verify the fetch fix by advancing the fake origin's default branch **after**
  the bare clone, then asserting the new branch's file content matches the
  post-clone commit (proves it branched off freshly-fetched HEAD, not the
  stale clone-time snapshot).
- Verify stale-worktree recovery by `rm -rf`-ing a worktree dir while its git
  registration still exists, re-running the script, and asserting exit code 0
  plus correct content — not just "no crash".

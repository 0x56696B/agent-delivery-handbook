---
name: repo-onboarding
description: Use when an ADO repo of the platform has no *-bare clone yet under ~/work/<PROJECT> — covers finding the exact ADO project/repo, getting the authoritative sshUrl, running git clone --bare safely, and giving it an initial main worktree with its .env wired in. setup-task-branch.sh cannot help until this exists.
---

`setup-task-branch.sh` (see `ticket-bootstrap`) only iterates over
`<name>-bare` directories that already exist one level above
`~/work/<PROJECT>/tasks`. Use this skill first when a ticket touches a repo that
isn't bare-cloned yet.

## Step 1 — Bare-clone the repo

1. Identify the ADO project if unknown: `core_list_projects`.
2. Resolve a fuzzy/short repo name (e.g. "orchestrator", "file gateway") against
   the real repo list via `repo_repository` action `list` — match on
   substring, don't guess.
3. Fetch the authoritative clone URL: `repo_repository` action `get`, param
   `repositoryNameOrId` (**not** `repository` — that name is rejected). The
   `sshUrl` field is authoritative; use it verbatim, including the literal
   `%20` for space-containing project names (`v3/<org>/<url-encoded-project>/<repo>`
   — git does not re-encode/decode it, pass it through as-is, quoted). Never
   fabricate an SSH URL pattern even if an earlier `list` call only returned
   `webUrl`/`name` — always call `get` per repo for the real field.
4. Naming convention: `<repo-name>-bare` sitting beside `<repo-name>` in
   `~/work/<PROJECT>`.
5. `git clone --bare "<sshUrl>" "<repo-name>-bare"`. Batch independent clones
   in one bash call (`&&` or `;`) since they don't depend on each other.
6. Verify with `ls -d *-bare` — don't trust a swallowed exit code in a chained
   command.

**Gotcha:** SSH post-quantum key-exchange warnings from OpenSSH ("connection is
not using a post-quantum key exchange algorithm") are informational, not clone
failures — the clone still succeeds.

## Step 2 — Give it a `main` worktree

1. Copy `.env` from the plain `<repo>/.env` checkout into `<repo>-bare/.env` if
   it exists. Check first with `test -f` — some repos (e.g.
   `infra`) genuinely have none; skip cleanly, no downstream
   symlink either. `.env` paths need no confirm: the `guardrails` extension
   allows the copy and masks values as `*****` in any output. It prompts only
   to overwrite an unmanaged dotenv file.
2. `git --git-dir=<repo>-bare worktree add <repo>-bare/main main` — works even
   if the original clone's own working tree is currently on a different
   branch; the bare repo's `main` ref is independent of what's checked out
   elsewhere.
3. Symlink `.env` into the worktree (skip if step 1 was skipped):
   `ln -s ../.env <repo>-bare/main/.env`.

## Verification

- `worktree add` prints the checked-out HEAD commit — capture it as free
  evidence the worktree is real and on the right ref.
- Confirm the `.env` symlink resolves via matching inode numbers (macOS):
  `stat -L -f%i <path>` on both the bare root's `.env` and the worktree's
  `.env` symlink.
- `ls -d *-bare` in `~/work/<PROJECT>` gives an at-a-glance list of which repos
  already have a bare equivalent.

## Scope discipline

When repeating this for additional repos, don't assume the same task-branch
name or depth as a previous batch. Ask explicitly (e.g. via the `ask` tool,
"main only" vs "give me a branch name for an active ticket") rather than
reusing a bug-specific branch name from an earlier, unrelated task.

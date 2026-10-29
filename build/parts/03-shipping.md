# Shipping: The Pull Request Road

Code is done. Fix works. Now code must leave your cave and join the village. The road has gates. Each gate exists because something went wrong once. Walk in order. Agent walks with you, but you own every step.

pull request (PR) = a request to merge your branch into `main`. Others read it first.

worktree = second copy of the repo, own branch, same history. squash = all your commits become one commit on `main`.

## The road in one picture

**What** Nine stops between "code works" and "folder tidy".

**Why** See the whole road, and each gate makes sense. A gate you do not understand, you skip. A skipped gate bites later.

**How** Read the picture. Then read each stop.

```
 code done, one commit per repo
        |
   [1] security gate --- finding? fix (2 rounds max) or draft PR
        |
   [2] open PR --------- title, short body, link ticket, reviewers
        |
   [3] team note ------- one Slack line, posts by itself
        |
   [4] review comments - reply, never resolve their thread
        |
   [5] conflict? ------- merge target in, never rebase
        |
   [6] merge ----------- gates green, one ask, auto-complete
        |
   [7] after merge ----- Resolved, dev check, tester note, vault
        |
   [8] QA proof -------- ancestry check, then Ready for Retest
        |
   [9] cleanup --------- report first, delete only what you name
```

**Where in pack** `skills/workflow-router/SKILL.md` routes a ticket to the chain. Commands that start the stops: `commands/comments.md`, `commands/conflict.md`, `commands/pr-merge.md`, `commands/qa-deployed.md`, `commands/cleanup.md`, `commands/pr-status.md`.

> Rock rule: Learn the reason for each gate. Then the gate is not a chore.

## Gate one: the pre-PR security gate

**What** A secret scan plus a security helper agent. Both read your own diff before any reviewer does.

**Why** Reviewer is tired and misses a hole. Machine scan finds a committed key. Helper finds a guard that fails open (lets everyone in when it breaks). Catch them yourself.

**How**

1. Per repo with changes, from the tasks root: `./self-review.sh <task>/<repo> origin/main`. It writes the diff to `<task>/review/self-<repo>.diff` and four secret-scan reports (commits, staged, unstaged, untracked).
2. Start one `pr-security` subagent per repo, all in one batch. Give it repo name, worktree path, diff path, report paths, plan paths (and the contract text for a story). Read line 1 of each answer yourself: `VERDICT: clean` or `VERDICT: findings`.
3. Apply each ruling:

| Ruling | You do |
|---|---|
| clean | Gate passed. |
| false-positive | Add a rule-scoped allowlist entry to `gitleaks.toml` in the tasks root. Rerun. Not a fix round. Nothing goes into the repos. |
| fix-now | Amend the same commit (`git commit --amend -F <file>`). Rerun checks and `self-review.sh`. Rerun the live check if a non-test file changed. Ask `pr-security` again. |
| too-big | Draft PR path. |
| defer-bug | Draft one Bug and one ticket comment. PR goes on. |

4. At most 2 fix rounds. A third verdict with an unresolved finding you introduced takes the draft path. Think an "introduced" tag is wrong? Show `file:line` proof and ask once more. The second answer is final.
5. Write `<task>/review/SECURITY-GATE.md`: one section per repo per round, verdict lines copied word for word, then "Drafts awaiting approval", each in its own fenced block.

Origin decides: a finding on a `+` line of your diff is "introduced", so fix it now. Any other is "pre-existing", so file a Bug and let the PR go on.

**Light check.** Before any other push of your own code (early CI push, amend force-push, push onto a colleague's branch), run `./secret-scan.sh <task>/<repo> <base>`. Push only on `RESULT: clean`. Exit code 2 means scanner missing or base wrong. Do not push.

**Draft PR path.** Open with `isDraft: true`. Link the ticket, add reviewers. No auto-complete, no Slack line, no ticket move. Draft a Bug. Publish with `isDraft: false` once the gate passes. Re-fetch and check.

**Secret already on the remote.** An amend changes the commit id, so "which remote branches contain this commit" lies. Fetch the branch with an explicit refspec and scan the pushed range. A failed fetch means unknown: treat the secret as exposed. Remove it in this PR, draft a rotation Bug, and say "rotate credential" first in your report. Cite rule id and `file:line`. Never print the value. A merge-conflict resolution is exempt from this gate.

**Where in pack** `skills/pr-security-gate/SKILL.md`, `agents/pr-security.md`, `scripts/self-review.sh`, `scripts/secret-scan.sh`.

> Ugh. Fall: A scanner allowlist had no effect and gave no warning. A global allowlist is ignored when default rules are extended. Fix: rule-scoped block, and two smoke tests per scanner config (one case must fire, one must pass). The sources do not record results for this gate's nine planned checks, so test it on a throwaway branch first.

> Rock rule: Never print a secret. Cite the rule id and the line. Nothing more.

## Opening the PR

**What** One branch, one title, one short body, one linked ticket, the right reviewers.

**Why** Every repo uses the same headings, so a reviewer reads any PR the same way. Body must stand alone: the reader has not seen your ticket, branch, or chat.

**How**

1. Gate one passed. Branch is `<type>/<short-dash-summary>`, made from `main`.
2. Title is a Conventional Commit with ticket suffix: `type(scope): description (BUG-12345)`.
   - `type`: feat, fix, docs, refactor, perf, test, build, ci, chore, revert. `!` before the colon only for a breaking change. `scope`: the feature area, not the repo name.
   - `description`: lowercase, imperative, says the new behavior. Whole title under 100 characters. It becomes the squash commit message, so it must stand alone.
3. Body is template A (bug fix) or B (feature or chore). Exact headings, exact order, no extra heading.
   - A: `## Bug`, `## Root cause`, `## Fix`, `## Tests`, `## Evidence`.
   - B: `## What changed`, `## Why`, `## Tests`, `## Evidence`.
4. Body is 200 words or fewer, 4 bullets or fewer per section. `## Evidence` holds one before image and one after image for a visible change, one line on what each shows. Otherwise write "No visual change."
5. Create with the PR tool. It needs the repo id (a GUID), not the name. Fetch ids once with the repository list tool.
6. Link the work item. Re-fetch it and look for an `ArtifactLink` named "Pull Request" whose URL ends in your PR id. Do not trust the link call's own "ok". Branch policy can block an unlinked PR.
7. Add the standing optional reviewers (tech lead and main-workstream teammates). Ask the branch policy who is already attached (the CLI, a sanctioned exception, because no MCP tool shows it). Add only the missing people. Never add yourself.
8. Paste the PR link back in the same turn. Opening needs no prompt: the verification gate in the bug or story workflow is the permission.

**Forbidden wording.** Never write: "Fixes BUG 12345" or a hand-written "Related work items" (the tracker adds that line); "Live-verified against..." (a live check is part of a fix); a paragraph on what you left out of scope (file a Bug, cite it in one sentence); "Full suite: N/N passing"; "as discussed" or "see the diff"; an em dash; filler words (robust, comprehensive, properly, simply, just, significantly, cleanly). One fix across two repos? End each body with one sentence giving the other PR link.

**Where in pack** `skills/pr-creation/SKILL.md`, `skills/bug-workflow/SKILL.md` (Step 5 opens the PR), `skills/story-workflow/SKILL.md`, `rules/project/azure-cli-fallback.md`.

> Rock rule: Body for a stranger. If only you can read it, it failed.

## The auto-complete trap

**What** Auto-complete merges a PR by itself once all policies pass.

**Why** A PR once auto-merged unreviewed in about 15 seconds. `main` needed a manual revert. The reviewer tool can add only optional reviewers, and auto-complete was set right after. No policy required an approval yet.

**How** Only this order is safe: (1) mark the reviewer required with the CLI, since no MCP tool has that flag; (2) re-fetch the PR and check the reviewer reads as required; (3) only then set `autoComplete: true`. Error `TF401181` on step 1 means the PR already completed. You are late. Story Session B never arms auto-complete. The merge flow arms it last, on fresh gate reads.

**Where in pack** `skills/pr-creation/SKILL.md` (Auto-complete safety), `skills/pr-merge/SKILL.md` (Step 5).

> Rock rule: No auto-complete until a fresh read shows a required reviewer.

## The team note: one Slack line, automatic

**What** After a PR opens in the bug or story workflow, one line goes to `#<team-channel>`. No draft. No approval.

**Why** Every earlier approval got "yes". A prompt that always gets "yes" is noise. This line has fixed shape and no judgment, so it is safe.

**How** Exactly one line:

```
PR <PRID> for review (<repo>): <summary> (<Bug|Story> <N>)
```

- `<PRID>` is a link to the PR. `<N>` is a link to the work item.
- `<summary>` is the PR title with the `type(scope): ` prefix removed. Do not reword.
- A returned bug's new PR adds ` (re-fix)` at the end.
- Example: `PR 4567 for review (orchestrator): stop generating images for deck pictures (Bug 12345)`

Rules:

1. One post per PR (a ticket with PRs in two repos gets two posts). No @mentions: branch policy adds reviewers. A push to an open PR gets no post. A draft PR gets none.
2. Send with Slack `blocks`: one `rich_text` block with `text` and `link` elements, `text` set to the plain line as fallback. `<url|label>`, bare URLs, and markdown content type did not render links and collapsed lines. A post cannot be edited. Keep `%20` in tracker links. Test a new layout first as a DM to yourself.
3. After posting, read channel history and confirm it landed.

Any other Slack post: draft in a fenced block, wait for approval. "Talking to Tribe" covers it.

**Where in pack** `skills/pr-and-team-comms/SKILL.md`, `harness/project/RULES.md` (the one exception to the Slack gate).

> Rock rule: One fixed line posts alone. Everything else gets a draft.

## Handling review comments

**What** Reviewer wrote comments on your PR. You answer each with evidence. Command: `/comments <pr>`.

**Why** An agent that "fixes" a comment it never reproduced fixes a ghost. Reviewer wants proof.

**How** Agent picks the mode from the PR author. Your PR: author mode. Someone else's PR that holds your comments: reviewer mode.

Author mode:

1. Find or create the task folder for the branch. Read every thread word for word. In scope: first comment is real text, not deleted, status Active or Pending, last comment not yours. Skip system threads. Write `comments/THREADS.md`.
2. Re-read the code at each cited `file:line`, because the branch may have moved.
3. Sort each thread, show a table, ask once. You may change any row.

| Class | Meaning | Reply |
|---|---|---|
| fix | Real, belongs here | Reproduce, fix, verify, reply with commit |
| answer | Question, or code refutes claim | Reply with `file:line` |
| disagree | Real finding, wrong proposal | Reply with reasoning |
| defer | Real, out of scope | File a Bug, reply with its number |

4. Each `fix` is a bug. Reproduce first at the true failure boundary. A finding that does not reproduce becomes an `answer`. Fix the source. Never special-case the reviewer's example input. Run the PR-build checks. A failing check may already fail on the target: prove it with a scratch worktree.
5. Commit once, message in a file, `git commit -F`. PR has 1 commit: amend, push with `--force-with-lease`. PR has more: add one commit, plain push. Never amend a merge commit. Never write "address review comments".
6. Run the security gate with base `origin/<src>`. Ask before pushing.
7. Draft each reply in chat, in its own fenced block with thread id. It posts under your name, so use your voice. Cite `file:line` on the pushed commit. A fix names the commit. A defer names the Bug. Never "addressed" or "done" without evidence. Post in the same thread. Re-list and confirm.

**The thread resolution rule.** Agent pushes the fix and replies. Agent leaves the thread **Active**. Only the person who started a thread may mark it Resolved, Closed, or Won't Fix. A rule file watches the status-update tool. Two narrow exceptions live in the merge flow, on your own PR only: a `superseded` thread (every other commenter approved after their last comment) and a `chit-chat` thread you answer "Close". Nothing else.

Reviewer mode (your comments on someone else's PR): never edit, commit, or push on their branch. Agent writes `review/VERIFY-HANDOFF.md` for a fresh session to verify. Sources say it was written but not run against a real PR: treat it as untested.

**Where in pack** `skills/pr-comments/SKILL.md`, `commands/comments.md`, `rules/project/pr-thread-resolution.md`, `skills/pr-security-gate/SKILL.md`.

> Rock rule: You fix. You reply. They close.

## Merge conflicts

**What** Your PR no longer merges cleanly into `main`. Command: `/conflict <pr>`. It resolves the conflict and nothing else.

**Why** Others may have pulled your branch. Merge keeps history they know. Rebase rewrites it and breaks their copy.

**How**

1. Find the PR: one lookup per in-scope repo. Stop before any git command when the PR is not Active, is not yours (never touch another person's branch), has no conflict, or shows a policy rejection. Status "still computing": re-check after 15 seconds, up to 3 times.
2. Find the task folder from the repo symlink target. None? Create one with `setup-task-branch.sh --pr`. Sync the worktree with explicit fetch refspecs (a rule that tells git which branches to fetch). Bare clones have none by default, so a plain fetch does not move `origin/main`.
3. Save your PR's own diff first: `git diff origin/<target>...HEAD` (three dots), to an absolute path under `<task>/conflict/`. A redirect in a symlinked worktree lands inside the bare repo otherwise.
4. Merge the target in: `git merge --no-ff origin/<target>`. Expect a failure exit. Here `--ours` is your PR branch and `--theirs` is the target (rebase flips this). Read both sides of each hunk. Keep both intents. Leave no conflict marker. Never hand-merge a lockfile: fix the manifest, take the target's lockfile, regenerate it.
5. Prove nothing was lost. Save `git diff origin/<target>..HEAD` (two dots). Compare with the first patch. Explain every differing line. A vanished hunk of your change means a bad resolution: go back to step 4.
6. Run the PR-build checks. Write `conflict/CONFLICT-NOTES.md`. Ask. Then push with plain `git push origin HEAD:refs/heads/<src>`. Never `--force` or `--force-with-lease` here (unlike `pr-comments` on an amended commit). The merge only adds a commit.
7. Re-check merge status every 15 seconds, up to 4 times, until it says no conflict.

Never stash during a merge: `stash pop` once dropped the merge state. Never rebase. Never touch tickets or comments.

**Where in pack** `skills/merge-conflict/SKILL.md`, `commands/conflict.md`, `scripts/setup-task-branch.sh`.

> Ugh. Fall: Merging `main` into a branch silently retired part of an already shipped fix, because two designs touched the same files. Fix: state the trade-off in the PR, ask a human to confirm, prove the net change with the before and after patch diff.

> Rock rule: Merge, never rebase. Compare patches before you push.

## Merging your own PR

**What** Command `/pr-merge <pr>`. Agent checks six gates, clears failures, asks once, then arms squash auto-complete.

**Why** A merge is hard to undo. One combined ask beats many small prompts. Auto-complete armed on stale facts once merged a PR unreviewed.

**How**

1. Find the PR. Abandoned: stop (a human decision). Already merged: jump to the ticket step. Active: go on. Not yours: stop. This skill merges your own PRs only.
2. Build the gate table from five parallel reads: votes, threads, pipeline, linked items, policies.

| Gate | Pass rule |
|---|---|
| Approvals | At least one approve from someone who is not the author. No "waiting for author" or reject from anyone. |
| Comments | No open `feedback` thread. |
| Conflicts | Merges cleanly. |
| Pipeline | Newest build on the PR merge ref passed, against the current `main` tip. |
| Paired order | Title ends `(k/n)` with k above 1: every earlier partner already merged. |
| Policies | Every blocking policy approved or not applicable. Read through the CLI. Login declined: row says "not read" and does not block. |

3. Thread classes. `superseded`: every other commenter approved after their last comment, so the run closes it with no reply. `chit-chat`: praise or thanks only; you pick Close or Keep open. `feedback`: anything else. It blocks. Show words, not codes: approver name plus "approved", a star for "approved with comments".
4. Clear failing gates in this order, because a push resets votes and re-queues policies: conflict (subagent resolves it, or stop; the push stays behind your ask); comments (resolve with `pr-comments`, or DM the reviewer); approvals (offer a DM; a vote is a human act); pipeline (failed: stop; stale: next point); policy (name it and stop; never `bypassPolicy`).
5. Stale build: `main` moved, so the green build expired. A plain new pipeline run does NOT attach to the policy. Use the policy re-queue command (the PR page's Re-queue button), poll every 30 seconds, then re-run every gate on fresh reads. A table from before a push is stale.
6. One combined ask: repo, PR, source to target, squash, approvers, build, threads to close, ticket move, vault action. One question per chit-chat thread, then "Go" or "Stop".
7. On "Go": close the `superseded` and chosen chit-chat threads, re-read the PR, and abort if merge status, a vote, or the threads changed. Then arm auto-complete (the trap above): squash, delete source branch, `transitionWorkItems: false`, `bypassPolicy: false`, no merge commit message.
8. Re-read every 15 seconds, up to 4 times, until merged. Record the squash commit. Confirm the source branch is gone. Still active with auto-complete set: a policy waits. Name it and stop.

Name every approver, because the "1 Owner approval" rule has no machine-readable list. Never vote to satisfy a gate. With no PR number, agent only lists your active PRs, checks each read-only, and asks which to merge. It never merges a PR you did not pick.

**Where in pack** `skills/pr-merge/SKILL.md`, `commands/pr-merge.md`, `skills/my-pr-status/SKILL.md`, `skills/pr-comments/SKILL.md`, `skills/merge-conflict/SKILL.md`.

> Ugh. Fall: Green build, but the PR would not auto-complete. `main` moved and the build expired. A fresh run did not satisfy the policy. Fix: classify the build against the `main` tip, re-queue through the policy action, re-read policies.

> Rock rule: Fresh reads, one ask, never bypass policy.

## After the merge: state moves and vault entry

**What** Merge is not the end. The ticket moves one step. A tester note gets written. The vault learns what happened.

**Why** The gap between "merged" and "tester retests" is where fixes get lost.

**How** State ladder. One neighbouring state per write, then re-fetch:

| Fact | Bug | Story | Who writes |
|---|---|---|---|
| Every linked PR merged | Ready for Fix to Resolved | In Development to Ready for Test | Agent, no prompt |
| QA proof (next section) | Resolved to Ready for Retest | Ready for Test to In Test | Agent, no prompt |
| Tester verified | Closed | Pending PO Review | Tester only |
| Accepted | none | Accepted | Product owner only |

Rules for the write:

1. Fetch the item with relations. "All merged" means every linked PR Completed. Only some? No move: report "N of M merged".
2. Write a `test` on `/rev`, then `replace` the state. Re-fetch and check. A merge never moves the item, even with `transitionWorkItems: true`.
3. A returned bug (state went back from Resolved or later) is never overwritten. Agent never writes Closed, Pending PO Review, or Accepted.

Then `post-merge`, once per merged PR:

1. Dev deploy green: the deploy build on `main` is at or after the squash commit and succeeded. Running: look every 60 seconds, up to 20 times. Failed: stop and report.
2. Dev evidence. Web change: dev sits behind a private endpoint, so record "dev: not reachable from this host" and use the local flow run. API or answer change: run the API e2e regression pipeline against DEV (about 20 minutes) and confirm the new catalogue case passed.
3. Write `<task>/docs/HANDOFF.md` for the tester: what changed (user words), where to test, steps with expected results, evidence, a three-item tick list.
4. Draft a ticket comment in a fenced block. Post only after approval:
   ```
   @<tester> <what now happens, one sentence>. On <env>: <click path in one line>. Steps and evidence: <key steps>.
   ```
   Tester is the bug's creator, or whoever last moved it to "Bug Test Failed". Never reassign.
5. Vault: find the task page by ticket id. Append under `## Post-merge`:
   `- <date> · deploy <build id> <result> · dev: <evidence> · handoff docs/HANDOFF.md · comment <id or "not posted">`

The merge skill also closes the vault task page (status `review` to `done`) and appends one log line, `## [date] task | Completed PR <repo> #<pr>`, after reading the last lines of `log.md`. Never edit a past entry.

Decision records: per repo with a real code change, one page in `decisions/` (Decision, Context, Reasoning, Consequences). Reusable facts go in `notes/`. The skills and `vault/schema.md` agree on this layout.

**Where in pack** `skills/pr-merge/SKILL.md` (Steps 6, 7), `skills/post-merge/SKILL.md`, `harness/project/RULES.md`, `harness/project/AGENTS.md`, `vault/schema.md`, `vault/templates/decision.md`, `vault/examples/tasks/fix-meter-reading-rounding.md`, `vault/examples/decisions/2026-03-09-store-readings-as-decimals.md`.

> Ugh. Fall: The bug state rule changed three times in five weeks. A state write also returned HTTP 400 on a jump. Fix: one ladder note plus the `get_type` tool, one neighbouring state per write, skills hold only the triggers.

> Rock rule: Facts move state. Merge moves one step. QA proof moves the next. Tester closes.

## The deployed-to-QA check

**What** Proof that your fix really runs on QA. Only then does the ticket say "ready to retest".

**Why** Tester must never retest a build without your fix. In the launch period, testers gave negative feedback on pre-fix code, because fixes sat in `main` but not yet on QA. Dates lie: a fix merged before a deploy can sit on a branch that deploy never ships.

**How** Two skills. `deployed-version-check` (`/qa-deployed [service]`) says what runs on QA. `tasks-deployed-to-qa` says which of your tasks are really live.

1. Find the real deploy pipeline per repo. Some repos have two definitions with a shared name. One builds on every `main` push but skips the push and restart. It looks like a deploy in history and never touches the live app. The other fires on a git tag. Use that one. Read its latest successful build's `sourceVersion`. That is the deployed commit.
2. Cross-check the live app config where the CLI allows. Denied? Report the gap, use pipeline evidence, mark low confidence. Say `high` only with fresh evidence.
3. For each item, read the linked PR and "Fixed in Commit" relations. One item can carry commits in several repos. Record each pair.
4. Prove with ancestry, never dates. Ancestry asks: is the fix commit in the deployed commit's history? Run `git merge-base --is-ancestor <fix-sha> <deployed-sha>` after fetching with explicit refspecs (heads and tags, prune). Exit 0 is confirmed. Any other exit is not proven. Never round up to "probably fine".
5. Report one row per item, one sub-row per repo: CONFIRMED or NOT CONFIRMED. A production-provisioning story deploys nothing to QA: say "not applicable".
6. After a confirmed check: Bug Resolved to Ready for Retest. Story Ready for Test to In Test. No prompt. Re-fetch.

Corrected reading of pack text. `skills/tasks-deployed-to-qa/SKILL.md` Step 2 says to exclude Resolved and Ready for Test. The rules and other skills use the check as the gate that leaves those two states. Run it on items in Resolved or Ready for Test, and on success write the next state. Its Step 5 runs git in a bare clone path, which a guard forbids. Use the task-folder symlinks or the dedicated `main` folder.

**Where in pack** `skills/tasks-deployed-to-qa/SKILL.md`, `skills/deployed-version-check/SKILL.md`, `commands/qa-deployed.md`, `rules/project/no-parent-folder-repo-access.md`.

> Ugh. Fall: The web app merges to `main` but QA deploys a separate `qa` branch. A date check would have been wrong for exactly that repo.

> Rock rule: Ancestry or it did not happen.

## Task cleanup

**What** Remove finished task folders and their worktrees. Command: `/cleanup`, from the tasks root.

**Why** Every ticket leaves a folder and worktrees (second copies of the repo, own branch). Disk fills. Deleting work is destructive, so the tool reports first.

**How**

1. Stand at the tasks root (MCP servers load only from there). Run `./cleanup-task-folders.sh report`. Read-only. It prints one record per task folder, repo link, stray root file, and orphan worktree.
2. For each repo with unique commits, look up PRs by source branch, all statuses (Active beats Completed beats Abandoned). Get ticket state. PR-review folders use the PR status. Research folders have no ticket.
3. Classify:
   - **CLEAN**: every repo with unique commits has a Completed or Abandoned PR; nothing dirty, ahead, or diverged; age at least 7 days; ticket state Resolved, Ready for Retest, Closed, Cancelled, Duplicate, or Deffered (or no ticket).
   - **CLEAN (unused)**: no unique commits, any ticket state. **KEEP**: anything else, with the single strongest reason.
4. Show one table: folder, age, size, verdict, reason. Orphans and strays below. Ask once. Human may drop rows. Do nothing before approval.
5. Apply in order: `clean --apply`, `clean-worktree --apply`, `strays --apply`, `prune --apply`. Every mutating command is a dry run without `--apply`. The script archives markdown and text files, then removes worktree, local branch, and folder.
6. Batches of 3 or 4 folders, with an explicit `timeout`. A big batch once died at the 300 second tool cap after 7 of 14 folders. `async` does not lift the cap.
7. Report freed size, archive paths, and one line per kept folder.

Never delete a remote branch, push, complete or abandon a PR, or change a ticket state. `--force` needs your instruction naming the folder. Until cleanup runs, never remove a task-folder symlink, branch, or worktree the script made.

**Where in pack** `skills/task-cleanup/SKILL.md`, `commands/cleanup.md`, `scripts/cleanup-task-folders.sh`, `harness/project/RULES.md`.

> Ugh. Fall: An agent tidied out-of-scope branches, worktrees, and symlinks. The author needed them for testing. Now the wiring script has an exclusion list, and a rule says leave links alone.

> Rock rule: Report first. Delete only what the human names.

# Judging Others: Code Review

Now you are the reviewer. Someone else's PR waits. Their branch is their field. You read. You write comments. You do not plant. You do not pull. Agent gives you three helper reviewers. Helpers are fast. Helpers also over-claim. You stay the judge.

## What review is for

**What** A verdict on a PR you did not write: suspicious or not, does it do what it says, is it good, does it fit the whole system.

**Why** One tired reviewer has one blind spot. Three lanes cover three kinds. AI also raises PR volume faster than humans can read. The team asked to flag the important issues, not many comments.

**How** Command `/ado-review <pr-number>`. It loads `skill://pr-review` and runs to a verdict. An agent's review is a lane, not a vote. The human reviewer stays the merge authority.

**Where in pack** `commands/ado-review.md`, `skills/pr-review/SKILL.md`.

> Rock rule: Helper reports. You decide.

## Read the ticket first

**What** Find the PR. Pull the linked work items. Read them before the code.

**Why** The ticket is the spec the PR claims to implement. Without it you cannot judge "does it do what it says". A changed file the description never mentions is a lead.

**How**

1. Find the repo: list PRs with status All. The row names it. Fetch the PR with work item refs and changed files. Capture title, description word for word, branches, head commit, author, reviewers and votes, linked items, changed files.
2. Fetch each linked item with expand `All` (capital A; lowercase is rejected). Capture type, title, state, description or repro word for word, parent. None linked? Say so in one line.
3. Wire a read-only worktree from the tasks root:
   ```
   ./setup-task-branch.sh --pr <repo> --target-branch <target> <src-branch> PR-REVIEW-12345-<summary>
   ```
   Leave out `--target-branch` when the target is `main`. The script creates the folder, refuses a duplicate `PR-REVIEW-<number>-*`, fetches with explicit refspecs, and links one repo with no `.env`.
4. Check the worktree head equals the PR's last merge source commit. If not, the branch moved: rerun. Then `mkdir -p review`, run `./setup-task-lsp.sh`, and move the session into the folder.
5. Write `review/PR-CONTEXT.md` (metadata, description, each linked item, changed files) and `review/diff.patch` (`git diff origin/<target>...HEAD`, to an absolute path).

**Where in pack** `skills/pr-review/SKILL.md` (Steps 1 to 4), `scripts/setup-task-branch.sh`, `scripts/setup-task-lsp.sh`.

> Rock rule: Ticket first, then code. Check the head commit.

## Three lanes in parallel

**What** Three read-only helper agents, started in one batch. Each reads `PR-CONTEXT.md`, the worktree, and `diff.patch`.

**Why** One lens misses things. Run all three together.

**How** First **you read the diff yourself**. You write the final summary. You must be able to challenge each helper.

| Lane | Agent | Output | Question |
|---|---|---|---|
| Security | `security-reviewer` | `SECURITY-REVIEW.md` | Anything suspicious or malicious? |
| Quality | `reviewer` | `QUALITY-REVIEW.md` | Convention, spec match, test strength? |
| Architecture | `architect-reviewer` | `ARCHITECTURE-REVIEW.md` | Boundaries, contracts, risk? |

Security lane: read line by line for backdoors, inverted logic, weakened guards, exfiltration. Trace every consumer of each changed value: fails-closed, fails-open, or crashes. Check new tests still assert what they claim. Rule on any changed file the description omits.

Quality lane: repo convention; spec match both ways (ticket scope missing from the PR, PR scope missing from the description, description claims the code does not make); test strength. For test strength: a regression test sits where `regression-test-placement` says; the PR or its plan records a mutation check (test fails with the fix removed, passes with it back); before and after images for a visible change; no new code comments; no new dependency without reason; smallest change. A missing mutation record is a finding. The lane must not run tests to find out. Each finding names "one real way it could break". Example: a fix matched "please confirm" anywhere in a reply and cut short every drafted email holding those words.

Architecture lane: boundary breaks, contract stability for other repos, new response fields (the e2e contracts file forbids unlisted fields, so one fails the e2e run), design that concentrates risk.

Shared contract: read-only, no formatters, linters, or test suites. Every finding cites `file:line`. `## Verdict` first, then `## Findings` rated Critical, High, Medium, Low, Info. A dormant advisor, `PRSecurity`, wakes when `pr-review` loads and speaks up on a fails-open finding reported clean.

**Where in pack** `skills/pr-review/SKILL.md` (Step 5), `agents/architect-reviewer.md`, `harness/project/WATCHDOG.yml`, `skills/regression-test-placement/SKILL.md`.

> Rock rule: Read the diff before you send helpers.

## Compile and check every claim

**What** One file, `review/REVIEW.md`, and one chat report.

**Why** The human reads one verified report, not three raw ones.

**How**

1. Answer five questions in order: suspicious or malicious content (yes or no, with evidence); does the change do what description and ticket claim (gaps both ways); quality findings by severity; architecture trade-offs by severity; recommended action (approve, approve with comments, request changes).
2. **Check every helper claim against code before you repeat it.** Cite `file:line` yourself, not "the agent said". Lanes may disagree: one marks a claim inference, another proved the opposite.
3. Chat report, two parts split by a rule line. First `**Ticket summary**` (3 to 5 lines: id, type, title, the ask, the claimed fix; or one line saying none is linked). Then `**Review summary**` with the five answers. The same two parts head `REVIEW.md`. Translate helper jargon to plain words.

**Where in pack** `skills/pr-review/SKILL.md` (Step 6), `harness/global/APPEND_SYSTEM.md`.

> Rock rule: A claim you did not check is not yours to repeat.

## Writing comments

**What** Draft in chat. Post only when the author confirms each comment.

**Why** Comments post under the author's name. A long justification chain hides the point. A wrong patch costs a second review.

**How** Style notes from the pack:

1. Short, plain language. State the problem. Cite the concrete contract or file it breaks. Ask one direct question. Full reasoning lives in `REVIEW.md`.
2. **Small fix only when no design choice.** A few lines, one function: add a proposed-fix code block with no code comments inside it. A fix that needs a design decision stays a question. Say so. Do not draft a diff that needs its own review.
3. Iterate in chat: score each comment X out of 10 for importance, simplify the words, then add fixes only where a small one fits.
4. Strip incidental data (build ids, other pipeline files, other repos' branches) unless it is the finding.
5. Test a fix against the real failure mode. A sanitizer that returned the raw matched text still held link syntax. One that returned only the title still carried attacker text. What closed the gap: drop the tag when the URL is unverified.

**The anchor rule.** Every thread anchor (file path plus line range) sits on a file in the PR's changed-file list, inside its diff hunks. Comment text may name an untouched file when the diff's own change reaches into it. Findings the diff does not reach go in `REVIEW.md` and chat only. A thread anchored outside the diff never rendered and had to be deleted.

**Posting** after approval of each comment: one thread per finding, anchored with file path, start line, and end line. The API rejects an anchor without start and end offsets: use offset 1 and the line length. **Deleting** a posted comment: the MCP tool has no delete action. Use the CLI invoke call (a sanctioned exception), then set the empty thread shell to Closed.

**Where in pack** `skills/pr-review/COMMENT-STYLE-NOTES.md`, `skills/pr-review/SKILL.md` (Boundaries), `rules/project/azure-cli-fallback.md`.

> Rock rule: Name the problem. Fix only if tiny.

## Never touch their branch

**What** Someone else's branch is read-only for you.

**Why** Their history is theirs. A push can break their local copy.

**How** Never edit, push, merge, or abandon another person's branch. A read-only fetch into the review worktree is fine. Never set a thread to Fixed, Closed, or Won't Fix when another person started it. Never vote, comment, or complete the PR without explicit approval in the session.

**Where in pack** `harness/project/AGENTS.md` (Someone else's PR), `skills/pr-review/SKILL.md`, `rules/project/pr-thread-resolution.md`.

> Rock rule: Reviewer reads. Author writes.

## A vote is not merge authorization

**What** Casting "Approved" can merge the PR on the spot.

**Why** If the owner armed auto-complete and your vote satisfies the last blocking policy, the PR squash-merges at once. This happened.

**How** Before you vote approved, or approved with suggestions, on someone's PR:

1. Re-read the PR. Is auto-complete set, and by whom?
2. Read live policy state. No MCP tool shows it. Use the CLI.
3. Would your vote satisfy the last blocking policy? Then **ask the human first**.
4. Name votes in words: approved, approved with suggestions, waiting for author, rejected. Never a number.

**Where in pack** `harness/project/RULES.md`, `skills/pr-review/SKILL.md`.

> Ugh. Fall: An Approved vote on a colleague's PR merged it at once. A vote and a merge are two different acts.

> Rock rule: If your vote would merge, ask first.

# Talking to Tribe

Code is half the work. Words are the other half. Words go to the ticket, the PR, Slack, your manager. Each place has its own manners. Wrong manners cost days.

tribe = everyone who reads your words: tester, tech lead, teammates, product owner, manager.

One finding shapes all the rules below. In a study of 28 confusion and friction cases, confusion came from identifiers and undefined labels, not from length. Short is good. Clear is better.

## Ticket voice

**What** How to write in a work item: description, acceptance criteria, comments.

**Why** A ticket is a handoff note. A cold report ("the investigation found...") feels like a wall. A plain first-person note feels like a teammate.

**How**

1. Plain, first-person words, as if the requesting engineer wrote them. No third-person report tone. Source citations stay.
2. Write tag names without angle brackets. The tool strips them and leaves empty backticks.
3. Comments carry reasons and questions to people. Tag who must know. Keep short. No plan dumps.
4. Ask before you change a title, description, or state, and before you comment. No ask for: area path, iteration path, assigning to yourself, the state moves in the ladder of "After the merge", and any move or post a skill step orders. A step that says "show the draft" keeps its gate.
5. After any write, re-fetch and check the field. Always pass the project name, or you get "Client does not support form elicitation".
6. A story that fails its contract gate gets a comment naming the gaps. The tester comment after a merge has a fixed shape: see "After the merge".

**Where in pack** `rules/project/ado-ticket-voice.md`, `rules/project/ado-area-path.md`, `rules/project/tool-gotchas.md`, `harness/project/RULES.md`.

> Ugh. Fall: The voice rule first matched only the write call, after drafting was done. Its scope then widened to text drafted in chat. A rule must fire where words are made, not where they are sent.

> Rock rule: Write the ticket as the person who asked for it.

## PR text

**What** Title and body of a PR. "Opening the PR" has the recipe. Here is the manner.

**Why** PR text stands alone in history. The title becomes the commit.

**How**

1. Plain full sentences. Expand an acronym on first use. No pasted logs or diffs. Avoid every word in the forbidden list.
2. Commit message: what changed and why, in the PR voice. Written to a file, committed with `-F`. Never "address review comments".
3. Add no code comments. `self-review.sh` flags new comments in Python, TypeScript, and TSX files. None inside proposed fixes either.

**Where in pack** `skills/pr-creation/SKILL.md`, `skills/pr-comments/SKILL.md`, `scripts/self-review.sh`.

> Rock rule: PR text says what changed and why. Nothing else.

## Slack: draft or auto

**What** Two kinds of Slack post. One posts by itself. All others wait for a draft and approval.

**Why** A Slack post has an audience. It cannot be edited, and the tool cannot delete it. So most posts earn a gate. The one fixed line does not.

**How**

| Post | Gate |
|---|---|
| PR-open line (fixed shape, one per PR) | Posts by itself. |
| Review ask, disruption notice, any other post | Fenced draft. Post after approval. |
| Merge-flow DM to a reviewer, open-PR list | Draft in chat. Post on "send it". |

1. Default channel is `#<team-channel>`, unless the author names another. An engineering channel is for review asks and disruption notices, on request. To find a reviewer, check who authored recent PRs in that repo, then ask in the team channel and tag by name.
2. Post with `blocks` (rich text, link elements). Test a new format as a DM to yourself. Never post secrets, tokens, or `.env` contents. After a post, read channel history and confirm.

**Where in pack** `skills/pr-and-team-comms/SKILL.md`, `skills/wiki-comms/SKILL.md`, `skills/my-pr-status/SKILL.md`, `skills/pr-merge/SKILL.md`.

> Rock rule: Auto only for the one fixed line. Everything else, draft first.

## Approval language

**What** The words that mean "yes, do it".

**Why** Prose gates get missed under autonomy. Clear words make a gate easy to pass and hard to fake. At least 35 accepted answers were one token: "A", "go", "send it", "approved".

**How**

1. Strong approval: "send it", "approved", "write it", "go". These open the gate for posts, ticket comments, commits, and PR actions with an audience. Not sure? Ask one direct question. Do not guess.
2. Show the next iteration only, then stop. The human's next message is an iteration request, not approval. Send approved text unedited.
3. Drafts say exactly what was dictated. "Link only" means link only. "Never shorten a draft" is not permission to add background, fixes, emoji, or sign-offs. Show drafts in a fenced block.
4. Turn always-yes prompts into fact checks. The author said "do not prompt me when everything is in order" about state moves, opening the PR, and the PR-open note. Keep approval for posts with an audience.

**Where in pack** `harness/project/RULES.md`, `harness/global/APPEND_SYSTEM.md` (Drafts), `skills/wiki-comms/SKILL.md`.

> Rock rule: "send it" opens the gate. Silence does not.

## The writing standard (ASD-STE100) in plain words

**What** A simple-English standard for technical writing: ASD-STE100 (Simplified Technical English). The pack uses a short working subset for every sentence the agent writes.

**Why** Short, plain sentences cut misreads. One word, one meaning removes the clever word that can be read two ways.

**How** Check each reply against these before you send. Rewrite any sentence that fails.

| Rule | In plain words |
|---|---|
| One word, one meaning | Pick one word per idea. Do not swap synonyms. |
| Active voice | "The script writes the file." |
| Simple tenses | Simple present or simple past. Avoid "has been configured". |
| Short sentences | Steps about 20 words or fewer. Descriptions about 25. One idea each: need a comma to add a new clause? Split. |
| Limits | One relative clause. No more than 3 nouns in a row. |
| Steps are commands | "Open the file." Reuse names: do not coin a new name for a named thing. |
| No em dash | Use a period, comma, or hyphen. |

Exempt: quoted errors and logs, code and config, the human's text echoed back. The standard covers chat, drafts, PR text, ticket text, vault pages, and advisor notes.

**Where in pack** `harness/global/APPEND_SYSTEM.md`, `rules/global/no-emoji.md`, `vault/schema.md`.

> Rock rule: One idea, one sentence. Short word beats long word.

## Translating codes for humans

**What** Replace every tracker code with its plain meaning before it reaches a person.

**Why** Reports once showed vote integers, merge-status codes, thread ids, and hashes. The author complained on three separate days. The fix came after the third.

**How**

Say these words. Never show the number behind them.

- PR status: Active, Abandoned, Merged.
- Merge status: conflicts, no conflicts (also: not set, queued, rejected by policy, merge failed).
- Thread status: Active, Resolved, Won't Fix, Closed, By Design, Pending. The API calls Resolved "fixed". Say "Resolved", the PR page word. Skip system threads.
- Vote: approved, approved with suggestions, waiting for author, rejected. Never "voted 10" or "-5".

1. Keep at most one raw anchor per item (one `file:line`, hash, or thread id), after its meaning. Put the rest in a doc in the task folder.
2. Define a coined label on first use: `<label> (<what it is>)`.
3. Translate every subagent or reviewer result before you show it. Relay is a source of jargon.

**Where in pack** `harness/project/AGENTS.md` (Vocabulary), `harness/global/APPEND_SYSTEM.md` (Words), `skills/my-pr-status/SKILL.md` (Step 4).

> Rock rule: If a human needs a decoder ring, translate.

## The daily update

**What** A short note to your manager, usually in Teams, on what you did yesterday.

**Why** Manager reads many notes. Two sentences are enough. Outcomes matter. Process steps do not.

**How** Say "daily" or "manager update". The agent runs the daily flow in `wiki-comms`:

1. Pull the day's finished work from `vault://wiki/log.md`, plus the PR and ticket numbers in those entries.
2. Draft in the author's style: two sentences at most; open with "As for me yesterday:" (swap the day name); state outcomes, not steps ("linked to the ticket and moved to Resolved" becomes "tickets are up to date"); drop verification detail once work sits in an open PR; keep bug and PR numbers; drop state names, tool names, skill names.
3. Show the draft in a fenced block. The author sends it. No Teams send route exists.

Example (numbers illustrative):

```
As for me yesterday: opened PR 4567 for the upload-name bug (Bug 12345) and answered review comments on PR 4568. Tickets are up to date.
```

Only when asked, a recap ("what did I do yesterday?") is one line each, no codes: PRs with owner, tasks touched, open decisions.

**Where in pack** `skills/wiki-comms/SKILL.md`, `vault/log.md`, `skills/morning-brief/SKILL.md`, `skills/daily-work-poll/SKILL.md`.

> Rock rule: Two sentences. Outcomes. Numbers kept, jargon dropped.

## Scan findings: Checkmarx and security issues

**What** Two kinds of security finding: a static-scan report from a pipeline (Checkmarx One), and a gate finding on your own diff. Both end as Bugs or fixes, not as guesses.

**Why** The same scan template makes the same finding in every repo. The artifact download tool reports success and writes an empty file. A skipped scan stage does not mean a clean repo.

**How** Checkmarx report:

1. Get a task folder first. Never download into the tasks root. Use the ticket's folder, or the ticketless `RESEARCH-00000-checkmarx-<repo>`. Downloads go in `<task>/checkmarx/`.
2. Find the build that ran the scan. The scan is a pipeline stage set to continue on error, so it never fails the build. No report artifact means the stage was skipped, not that the repo is clean.
3. Read counts from the build log first: scan id, overall risk, the per-engine table, portal link. Container findings are base-image findings and triage differently.
4. Download the report. The MCP download is broken for this type. Retry once at most, then use the CLI. A real report is hundreds of KB. A 0-byte file means failure. Overwrite in place.
5. Triage each finding against the worktree with `file:line` evidence: Real, False positive (name the line that proves it), or Duplicate (name the ticket). Never classify from the title alone.
6. One Bug per real finding, not per scan. Base-image findings usually get one Bug for the image upgrade. Ask before you create any work item.
7. Record the scan as a vault note in `notes/`, named `<date>-<repo>-checkmarx-scan-report-build-<id>.md`.

Team rules around this: the release gate is zero critical and zero high findings. A false-positive class (for example typed queries flagged as injection) is documented as a waiver in a PR. Findings on your own diff follow the gate in "Shipping": fix introduced ones, file Bugs for pre-existing ones, rotate exposed secrets. Never put a secret value in a draft, comment, or file.

**Filing a Bug from a finding.** Model it on a recent real Bug from the same area. Fetch one with all fields and mirror its layout. Do not invent fields. Draft and show the human before you create. Title: what the user gets, in plain English, not the cause. Repro steps: numbered, what happens and what should happen. How QA checks it: the click path on dev or QA (a finding with no screen uses `file:line` and the check that proves the fix). Three things the tester can tick off. Screenshots attached. Area path per the area-path rule. Iteration, priority, severity from the model Bug. Assigned to a named person. After creating, re-fetch and confirm state, iteration path, and board column. Link it Related to the source item and re-fetch relations. From a PR thread? Post the new Bug number back in the thread.

**Where in pack** `skills/checkmarx-handling/SKILL.md`, `skills/pr-and-team-comms/SKILL.md`, `skills/pr-security-gate/SKILL.md`, `agents/pr-security.md`, `rules/project/task-files-in-ticket-folder.md`, `rules/project/azure-cli-fallback.md`, `rules/project/ado-area-path.md`.

> Ugh. Fall: A download "succeeded" with a 0-byte zip. The CLI login did not satisfy the extension's artifact tool. Fix: CLI fallback into the task folder. Check the file size.

> Rock rule: Triage by line, not by title. One Bug per real finding.

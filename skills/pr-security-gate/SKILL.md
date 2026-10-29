---
name: pr-security-gate
description: Use before opening any PR on the platform and before pushing your own code to an open PR. Runs secret-scan/self-review, spawns the pr-security subagent, applies the fix-or-defer rules, and writes review/SECURITY-GATE.md.
---

# Pre-PR security gate

Run this gate on your own code before it reaches a reviewer. A clean result lets the flow continue. A finding is fixed in this PR, or deferred to a new Bug. The `pr-security` subagent rules on each finding; you apply the ruling.

Run every command from `~/work/<PROJECT>/tasks`. Never print a secret value anywhere: chat, files, PR text, ADO text. Cite the gitleaks rule ID and file:line only.

## 1. When

Run the full gate (sections 2 to 6):
- Before every new PR: `bug-workflow` ("One commit per repo"), `story-workflow` ("Open the PR"), `pr-creation`.
- Before every push of your own code to an open PR: the returned-bug open-PR mode in `bug-workflow`, and `pr-comments` ("Push, after the user approves").

`merge-conflict` is exempt. A merge resolution adds no new code of yours.

Before ANY other push of your own code (a Story Session B early CI push, the bug amend force-push, a bootstrap push onto a colleague's branch ("Pick up a colleague's existing work")), run:

```bash
./secret-scan.sh <task>/<repo> <base>
```

Push only when it prints `RESULT: clean`. On a finding, run the full gate first. Exit code 2 means gitleaks is missing or the base is wrong; fix that, do not push.

## 2. Inputs

Per repo with changes:
- Base `origin/main` for a new PR.
- Base `origin/<src>` for a push to an open PR. An added commit then checks only the new delta. An amended single commit rescans the whole PR.

## 3. Run

1. Per repo: `./self-review.sh <task>/<repo> <base>`. It writes `<task>/review/self-<repo>.diff`, the gitleaks reports `<task>/review/gitleaks-<repo>-{commits,staged,unstaged,untracked}.tsv`, and a `## Secrets in content (gitleaks)` section.
2. Spawn one `pr-security` task per repo, all in ONE `task` batch. Give each task:
   - the repo name and the worktree path `<task>/<repo>`;
   - the diff path and the four gitleaks report paths;
   - the plan file paths under `<task>/plan/`;
   - for a story, the Agent Contract text.
3. Read each verdict yourself. Line 1 is `VERDICT: clean` or `VERDICT: findings`.

## 4. Apply the verdict

- `VERDICT: clean`: the gate passed for that repo.
- `false-positive`: add an allowlist entry to `~/work/<PROJECT>/tasks/gitleaks.toml`, then rerun `self-review.sh`. This is not a fix round. Put the entry under the `[[rules]]` block for that rule ID. Create the block at the end of the file if it does not exist:

  ```toml
  [[rules]]
  id = "<RuleID>"
  [[rules.allowlists]]
  description = "<TICKET>: <reason> (pr-security ruling <YYYY-MM-DD>)"
  paths = ['''(^|/)<repo-relative path, regex-escaped>$''']
  ```

  A second entry for the same rule ID is a second `[[rules.allowlists]]` table under the same `[[rules]]` block. A rule-scoped entry can expose another rule on the same file:line (for example `generic-api-key` after `aws-access-token`). That row is the same secret: add one `[[rules]]` block per rule ID that fires there, with no new `pr-security` ruling. Nothing goes into the repos.
- `fix-now`:
  1. Make the fix in the same commit (`git -C <task>/<repo> commit --amend -F <file>`).
  2. Rerun the repo checks ("PR-build checks per repo" in `service-startup-reference`).
  3. Rerun the live check when the fix changes any non-test source file.
  4. Rerun `self-review.sh` and spawn `pr-security` again.
  At most 2 fix rounds. A third verdict with an unresolved `introduced` finding takes the draft-PR path.
- Challenge: you may hold file:line evidence that an origin tag is wrong. Spawn `pr-security` once more with that evidence. The second ruling is final. A challenge is not a fix round.
- `fix-size: too-big`: take the draft-PR path.
- `defer-bug`: draft one Bug and one ticket comment (section 5). The PR proceeds.

### Draft-PR path

1. Create the PR per `pr-creation` with `isDraft: true`. Link the work item and add reviewers as normal.
2. Do not set auto-complete. Do not send the Slack review request. Do not move the work item.
3. Draft a Bug for the fix (section 5).
4. After the fix lands and the gate passes, publish with `repo_pull_request_write` `update` `isDraft: false`. Re-fetch the PR and confirm `isDraft` is false.

### Secret on the remote

An amend changes the commit SHA, so `git branch -r --contains` does not show exposure. Per repo, fetch the branch first, then check that the ref exists:

```bash
git -C <task>/<repo> fetch -q origin "+refs/heads/<src>:refs/remotes/origin/<src>"
git -C <task>/<repo> rev-parse --verify -q origin/<src>
```

A failed fetch on a branch that may exist on the remote means exposure is unknown: treat the secret as on the remote.

If it exists, scan the pushed range:

```bash
gitleaks git <task>/<repo> \
  --log-opts="$(git -C <task>/<repo> merge-base origin/main origin/<src>)..origin/<src>" \
  --no-banner --redact -c ~/work/<PROJECT>/tasks/gitleaks.toml --exit-code 3 \
  --report-format template --report-template ~/work/<PROJECT>/tasks/gitleaks-report.tmpl \
  --report-path <task>/review/gitleaks-<repo>-remote.tsv
```

Exit 0 means no hit, 3 means hits, any other code is an error (treat the secret as on the remote). A local finding is on the remote when its RuleID and File also appear in the remote report. A `pre-existing` finding with `kind: secret` is on `main`, so it is also on the remote.

For a secret on the remote:
1. Remove it in this PR.
2. Draft a rotation Bug (section 5).
3. Put "rotate credential" first in the final report, with the rule ID and file:line.

A secret only in local, unpushed history needs no rotation note. The amend removes it.

## 5. Record

Write `<task>/review/SECURITY-GATE.md`:
- One `## <repo> round <n>` section per `pr-security` run. Copy the verdict lines verbatim. Add the action you took per finding and any new allowlist entry.
- Then `## Drafts awaiting approval`. Put each Bug draft and each one-line ticket comment in its own fenced code block.

Bug drafts use the shape in `pr-and-team-comms` "Filing a new bug from a finding" step 2. A finding with no UI surface replaces the browser click path with the file:line and the check that proves the fix. Never put a secret value in a draft.

The ticket comment is one line that names the new Bug and the finding, for example: `Security gate: pre-existing <rule> at <repo>/<path>:<line>, tracked in Bug <new-number>.`

## 6. Final report

Add these lines, in this order, only when they apply:
1. Rotation needed: rule ID and file:line per secret.
2. "File these N Bugs and comments? Drafts: `<task>/review/SECURITY-GATE.md`"
3. New allowlist entries in `gitleaks.toml`.
4. Draft PR status, and the finding that holds it.

The PR does not wait for this approval. On user approval, file each Bug per `pr-and-team-comms` "Filing a new bug from a finding" (create, re-fetch, link `Related`, re-fetch). Then post the one-line comment on the current ticket and re-fetch it.

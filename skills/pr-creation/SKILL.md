---
name: pr-creation
description: Use when opening a pull request in any repo of the platform. The single standard for PR title, description structure (two fixed templates), forbidden wording, work-item linking, the standing optional-reviewer list, and auto-complete safety. Covers everything up to "PR is open, linked, reviewers added". Hand off to pr-and-team-comms for the Slack notification, review replies, and the vault entry.
---

# Opening a PR: the platform standard

Every PR in every repo in this workflow uses the same title shape, one of two
description templates, and the same reviewer list. Consistency across repos is
the point. A reviewer must read the same headings on a `web-app` PR and on
a `data-mcp` PR.

**The description is written for a human.** The reader is any developer on the
team, not the author and not a tool. Write it so that a developer who has never
seen the ticket, the branch, or the code can read the description alone and
understand what broke, why it broke, and what changed. Plain language, full
sentences, no internal shorthand. A description that only makes sense to the
person who wrote the patch has failed, whatever headings it carries.

Official upstream source: ADO repo `<STANDARDS_REPO>`, file
`/Git Standards/README.md`. It sets trunk-based branching, Conventional Commit
PR titles, squash-only merge, and a 1 Owner approval minimum. It says nothing
about description structure. The templates below are the local standard.

## Checklist

0. The security gate passed (`pr-security-gate`).
1. Branch is `<type>/<short-dash-summary>`, created off `main`.
2. Title is a Conventional Commit with the ticket suffix.
3. Description uses template A (bug fix) or template B (feature or chore).
4. Create the PR with `repo_pull_request_write` action `create`.
5. Link the work item, then re-fetch the work item to confirm the link.
6. Add the standing optional reviewers.
7. Paste the PR web URL back to the user in the same turn.
8. Arm auto-complete only after a required reviewer is confirmed.

## Title

`type(scope): description (BUG-NNNNNN)`

- `type`: one of `feat|fix|docs|refactor|perf|test|build|ci|chore|revert`. Add
  `!` before the colon only for a breaking change.
- `scope`: the feature area, not the repo name. Examples: `chat`,
  `prompt-ideas`, `data-api`, `docker`, `auth`.
- `description`: lowercase, imperative, states the new behavior, not the
  activity. Keep the whole title under 100 characters.
- Ticket suffix: append `(BUG-NNNNNN)` or `(STORY-NNNNNN)` when a ticket
  exists. Omit it only for a ticketless one-off fix.
- The title becomes the squash commit message. It must stand alone in history.

Example titles to copy:

- `fix(prompt-ideas): filter by direct prompt match before category fallback (BUG-12345)`
- `fix(help): add close button to Prompt ideas panel (BUG-12346)`
- `feat(infra): provision and deploy media-mcp to production (STORY-12347)`

## Template A: bug fix

Use for any `fix/` or `hotfix/` branch that closes a Bug ticket.

```md
## Bug
<What the user sees, and what is wrong about it. One or two sentences.>

<Optional second paragraph: the concrete observed numbers. Example: searching
"generation" returned all 11 prompts in the category instead of the 2 that
contain the word.>

## Root cause
<The mechanism. Name the file and the function that does the wrong thing.>

## Fix
- <Change one, in behavior terms.>
- <Change two.>

## Tests
- `<test file>`: <the case it adds>.

## Evidence
- Before: <image or "No visual change.">
- After: <image, one line on what it shows>
```

Model: PR 4567 (`web-app`).

## Template B: feature or chore

Use for `feat/`, `chore/`, `ci/`, `docs/`, `refactor/`, `perf/`, `build/`,
`test/`, and `spike/` branches. Also use it for a small UI addition that has no
real root cause, even on a `fix/` branch.

```md
## What changed
<What the change adds or removes, and where. One to three sentences.>

## Why
<The prior behavior, or the gap that made this necessary.>

## Tests
- `<test file>`: <the case it adds>.

## Evidence
- Before: <image or "No visual change.">
- After: <image, one line on what it shows>
```

Model: PR 4566 (`web-app`).

## Rules for both templates

- Use these exact headings, at `##`, in this order. Add no other heading.
  Rename none of them.
- `## Evidence` carries one before and one after image for a change people
  can see, taken from the flow-runner run folder and uploaded as PR
  attachments, with one line each on what the image shows. A change with no
  visible effect writes "No visual change." The images do not count toward
  the word cap.
- Total length: 200 words or less. Four bullets or less per section.
- Put file names and symbols in backticks. A `file.ts:line` anchor is useful
  but goes stale, so use it only for a stable landmark.
- Write for a human reader first. The description must stand on its own: no
  dependency on the ticket text, the diff, the branch name, or session context.
  Expand an acronym on first use. Never paste raw tool output, stack traces, or
  a diff in place of an explanation.
- Write to ASD-STE100: active voice, simple present or simple past, one topic
  per sentence, 20 words or less per instruction sentence.
- Never use an em dash. Use a period, a comma, or a hyphen.
- One fix across two repos: end each description with one sentence that gives
  the companion PR URL, so a reviewer on either side sees the other change.

## Forbidden wording

| Never write | Why |
|---|---|
| `Fixes BUG 12345`, `Fixes #12345`, a hand-written `Related work items: #12345` | The linked work item already records this, and ADO appends the line to the squash message itself. |
| `Live-verified against the real ...`, `Live-verified in the running dev server`, `Manually tested against ...` | A live check is an implied part of fixing a bug, not a claim for prose. |
| A paragraph about what you left out of scope. Example to avoid: "`get_price_forecast` and `get_volume_forecast` share the same latent pattern but are not implicated by this ticket's repro and are intentionally left out of scope here." | A reviewer cannot act on it. File a real bug for the related defect and cite its number in one sentence, or leave it out. |
| An em dash | Team writing standard. |
| `robust`, `comprehensive`, `properly`, `simply`, `just`, `significantly`, `cleanly` | Filler. State the behavior instead. |
| A wall of prose with no headings | This is the reason the standard exists. |
| Author-only shorthand: a bare ticket number as an explanation, a branch name as a noun, `as discussed`, `per the repro`, `see the diff` | The reader may have none of that context. State the fact instead. |
| `Full suite: <N>/<N> passing.`, or any full-suite pass count in a PR description or commit message | A passing suite is implied by opening the PR or pushing the commit. If it does not pass, the pipeline fails and shows it. |

PR 4568 (`data-mcp`) breaks four of these rules at once. Read it once as
the anti-pattern, then never copy its shape.

## Link the work item (always)

- A PR that has a ticket MUST carry the linked work item. `Check for linked
  work items` is a branch policy in this project, so an unlinked PR can be
  blocked from completing. Link before you ask for review, not after.
- After linking, re-fetch the work item's relations. Confirm a relation with
  `rel: "ArtifactLink"` and `name: "Pull Request"` whose URL ends in the PR id.
  Do not trust the link call's own success response.
- Ticketless one-off fix: no link, and no ticket suffix in the title. If the
  linked-work-item policy then blocks completion, tell the user. Never invent a
  ticket to satisfy the gate.

## Standing optional reviewers (always)

Add these four people to every PR, in every repo. They are the product-team
developers and the technical lead.

| Person | Email | ADO identity id |
|---|---|---|
| `<TEAMMATE_1>` | `<TEAMMATE_1_EMAIL>` | `<IDENTITY_ID_1>` |
| `<TEAMMATE_2>` | `<TEAMMATE_2_EMAIL>` | `<IDENTITY_ID_2>` |
| `<TEAMMATE_3>` | `<TEAMMATE_3_EMAIL>` | `<IDENTITY_ID_3>` |
| `<TECH_LEAD>` | `<TECH_LEAD_EMAIL>` | `<IDENTITY_ID_4>` |

- Call `repo_pull_request_write` action `update_reviewers` with
  `reviewerAction: "add"` and `reviewerIds` set to the ids above.
- The branch policy, not a past PR's reviewer list, decides who is already on
  a PR. Read it with
  `az repos policy list --org "https://dev.azure.com/<ADO_ORG>/" --project "<ADO_PROJECT>" --repository-id <guid> --branch main --query "[?type.displayName=='Required reviewers'].settings.requiredReviewerIds" -o json`.
  No MCP tool exposes branch policies, so this is a sanctioned Azure CLI
  exception under `.omp/rules/azure-cli-fallback.md`.
- Policy-required reviewers per repo, read from that command on 2026-09-17
  (illustrative shape; read your own repos' policies):

  | Repo | Already required by policy | Of the four, still to add |
  |---|---|---|
  | `web-app` | `<REVIEWER_A>`, `<REVIEWER_B>`, `<REVIEWER_C>` | all four |
  | `data-mcp` | `<TEAMMATE_1>`, `<REVIEWER_C>` | the other three |
  | `orchestrator` | all four, plus `<AUTHOR>` and `<REVIEWER_D>` | none |
  | `media-mcp` | all four, plus `<AUTHOR>` | none |
  | `file-gateway` | none | all four |
  | `infra` | none | all four |

- Add only the people the policy has not already attached. A duplicate add is
  harmless, but adding a policy-required reviewer again is noise.
- `orchestrator` and `media-mcp` both require the author
  (`<AUTHOR_IDENTITY_ID>`). When the author opens the PR,
  their own vote never counts toward the approval minimum, and they are already
  on the PR: never add yourself.
- The policy returns identity ids, not names. Resolve an unfamiliar id with
  `core_get_identity_ids` (by email) or by reading a past PR's reviewer list on
  that repo, which carries `displayName` next to each id.
- Re-read the policy if a repo's list looks wrong. The table above is a
  snapshot; the policy is the authority.
- These are optional reviewers. An optional reviewer never blocks completion.
- Never add yourself.
- If an identity id is rejected, resolve it again with `core_get_identity_ids`
  and the person's email, then retry.

## Auto-complete safety

`update_reviewers` has no `isRequired` field. It adds optional reviewers only.
Setting `autoComplete: true` right after it can merge the PR at once,
unreviewed. Real incident on 2026-08-18: PR #4001 (`file-gateway`,
BUG-12348) auto-merged within 15 seconds, before the required reviewer voted.
`main` needed a manual revert.

Correct order:

1. Mark the reviewer required:
   `az repos pr reviewer add --id <prId> --reviewers <email> --org "https://dev.azure.com/<ADO_ORG>/" --required true`.
   No MCP tool exposes the required flag. This is the sanctioned Azure CLI
   exception under `.omp/rules/azure-cli-fallback.md`.
2. Re-fetch with `repo_pull_request` action `get`. Confirm the reviewer entry
   now reads as required. Do not trust the CLI call's own output.
3. Only then call `repo_pull_request_write` action `update` with
   `autoComplete: true`.
4. `TF401181` from step 1 means the PR already completed. You are too late; the
   command is not wrong.

## Draft PR (security hold)

An introduced security finding that is too big to fix in this PR opens the PR
with `isDraft: true`. Follow the draft-PR path in `pr-security-gate`: no
auto-complete, no Slack review request, no work-item move until the gate
passes and the PR is published.

## Mechanics

- `create` needs `repositoryId`, the repo GUID. `repository: "<name>"` fails.
  Fetch every id once with `repo_repository` action `list`, and cache them in
  the task's plan folder if you will open more than one PR.
- GUIDs for the repos in this workflow (read once with `repo_repository`
  action `list`; never hard-code another team's):
  - `web-app` `<REPO_ID_WEB_APP>`
  - `data-mcp` `<REPO_ID_DATA_MCP>`
  - `orchestrator` `<REPO_ID_ORCHESTRATOR>`
  - `media-mcp` `<REPO_ID_MEDIA_MCP>`
  - `file-gateway` `<REPO_ID_FILE_GATEWAY>`
  - `infra` `<REPO_ID_INFRA>`
- Merge type is squash, in every repo. One commit per PR.
- Minimum 1 approval from a repo Owner. Self-approval never counts. Required
  build, test, lint, and security checks must pass before merge.
- Opening a PR needs no prompt in the Bug workflow once its verification
  passes (`bug-workflow`, "One commit per repo", the "Open the PR without
  asking" item). In Story Session B
  (`story-workflow`), the verification gate also replaces the prompt:
  open the PR directly.

## After the PR is open

`pr-and-team-comms` owns what comes next: finding a human reviewer, the
Slack notification, replying to review threads, filing a bug from a review
finding, and the vault decision page.

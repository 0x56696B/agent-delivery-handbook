---
name: my-pr-status
description: Use when the user asks for a status report on their own open Azure DevOps pull requests across the platform's repos — covers listing every active PR by the current user across all repos, checking merge conflicts, reviewer votes, and comment threads, and reporting in the exact grouped-by-repo format with status, votes, comments, and blockers.
---

## Input

None required. The invoker is the current user.

## Step 1 — List every active PR by the current user

MCP tool `repo_pull_request`, action `list`, once per known repo (no
project-wide "all repos" list call exists):

    { "action": "list", "repositoryId": "<repo>", "project": "<ADO_PROJECT>",
      "created_by_me": true, "status": "Active" }

Known repos: `orchestrator`, `data-mcp`,
`media-mcp`, `file-gateway`, `web-app`,
`infra`. Run all six calls in parallel. Record each hit's
`pullRequestId`, `title`, `sourceRefName`, and `repositoryId`/name.

Always fetch live. Never take a PR, a vote, or a comment from memory, the
vault, or earlier turns of the session.

## Step 2 — Fetch full detail per PR

For each PR found, in parallel: `repo_pull_request` action `get` with
`repositoryId`, `pullRequestId`, `project: "<ADO_PROJECT>"`. Capture:

- `mergeStatus` (3 = succeeded, no conflicts; anything else needs a note)
- `reviewers[]` — `displayName` + `vote` (10 approved, 5 approved with
  suggestions, 0 no vote, -5 waiting for author, -10 rejected)
- `title` and the BUG/US ticket number in it
- `lastMergeCommit.commitId` and `lastMergeTargetCommit.commitId`

## Step 2a — Fetch pipeline status per PR

For each PR, in parallel: `pipelines_build` action `list` with
`project: "<ADO_PROJECT>"`, `branchName: "refs/pull/<pullRequestId>/merge"`,
`top: 5`. Take the newest build (highest `id`). Also once per repo, in
parallel: `repo_branch` action `get` with `branchName: "main"`. Record its
`objectId` as the main tip.

Build `status`: 1 running, 2 completed. Build `result` (when completed):
2 succeeded, 4 partially succeeded, 8 failed, 32 canceled.

Classify the `checks` value in this order:

- No build in the list: `no run`.
- Newest build `status` 1: `running`.
- Newest build `result` 8, 4, or 32: `failed` (name the result).
- Newest build `result` 2, but the PR's `lastMergeTargetCommit.commitId`
  differs from the main tip: `stale`. Main moved after the run, so the
  green result no longer covers the PR. The PR needs a re-run.
- Newest build `result` 2 and the build `sourceVersion` differs from the
  PR's `lastMergeCommit.commitId`: `stale`. A newer push has no run.
- Otherwise: `passed`.

Limit: the Azure DevOps MCP tools do not expose branch policy settings.
The `stale` rule assumes the policy expires a build when main moves. This
is an inference. Do not claim the policy forces it.

## Step 3 — Fetch comment threads per PR

For each PR, in parallel: `repo_pull_request_thread` action `list` with
`repositoryId`, `pullRequestId`, `project: "<ADO_PROJECT>"`. A real
review thread has a `status` field and at least one comment. System
messages ("Policy status has been updated", "voted -5", "set
auto-complete", reviewer-added events) have no `status`; skip them. A
real thread may have `threadContext: null` (a general PR comment).

- Open: status is 1 (Active) and the last comment is not from the PR
  author.
- Fixed: status is 2 or higher, or the last comment is from the PR author.

Auto-complete is armed when the `get` response has `autoCompleteSetBy`.

Note the author and a one-line gist of any open comment; these become
blockers.

## Step 3a — Filter out safe auto-complete PRs before drafting outreach

Drop a PR from any "needs attention" list (for example a Slack draft) when
it meets all five conditions:

- Auto-complete is set on the PR (it will merge on its own).
- It already has enough real, non-self approvals for the 1-approval-from-
  an-Owner policy.
- No open comment threads (Step 3 found none, or all are Fixed/answered).
- No merge conflicts (`mergeStatus: 3`).
- Pipeline `checks` is `passed` (Step 2a). A `stale`, `failed`, `running`,
  or `no run` pipeline means the PR will not merge on its own.

Such a PR will merge soon on its own; it is not worth a reviewer's
attention. Still count it in the batch summary sentence for completeness,
but do not draft an ask for it.

## Step 4 — Report in this exact format

The user chose this format on 2026-10-05. Output one fenced code block and
nothing else: no preamble, no explanation, no offer of a next step.

    MY OPEN PRs · <PROJECT> · <YYYY-MM-DD HH:MM>
    ════════════════════════════════════════════════════════════════════


    <repo-name>
    ────────────────────────────────────────────────────────────────────
    #<id>  <short title without ticket prefix>              <TICKET-NUMBER>
            votes     <n> approved (<names>)   <n> waiting (<names>)   <n> rejected (<names>)   <n> pending (<names>)
            comments  <n> total · <n> open · <n> fixed
            checks    <passed · failed (<result>) · stale, re-run needed · running · no run>  build #<id>
                      <Name> ×<n> open    <Name> ×<n> fixed
            state     <one line>


    <next repo ...>


    ────────────────────────────────────────────────────────────────────
    <N> PRs · <n> ready · <n> waiting for author · <n> conflict · <n> pipeline

Rules:

- Header rule is 68 `═`. Repo and footer rules are 68 `─`. Two blank lines
  before each repo name and before the footer rule. Repos in the order of
  the Step 1 list; skip a repo with no PR.
- Title line: `#<id>`, two spaces, title padded to 50 columns so the
  ticket starts at column 59. Title is the PR title without the Conventional
  Commits prefix and without the ticket number. A title over 50 columns is
  cut at a word boundary and ends in `…`. Ticket as `BUG-<n>` or `STORY-<n>`.
- `votes` buckets map to the vote value: 10 and 5 → approved, 5 adds `≈`
  after `approved`; -5 → waiting; -10 → rejected; 0 → pending. Show only
  the approved, waiting, and rejected buckets with a count above 0. When
  all three are 0, show only `○ <n> pending (<names>)`. Names in
  parentheses, first name only. Exclude the PR author from every bucket.
- `comments` counts the real threads from Step 3, grouped by the author of
  the first comment. Second line lists each author with `×<n> open` and
  `×<n> fixed` parts; omit a zero part. Write `none` and drop the second
  line when the count is 0.
- `checks` is the Step 2a class on one line, with the newest build number.
  For `stale`, write `↻ stale, re-run needed (main moved)` or
  `↻ stale, re-run needed (new push)`. For `no run`, omit the build number.
- `state` is one human line, the single thing that blocks merge, in this
  priority: `Merge conflict with main`; `Pipeline failed`; `Rejected
  (<name>)`; `Waiting for author (<name>)`; `Open comments (<names>)`;
  `Pipeline needs re-run` (for `stale`, `running`, or `no run`); `Needs an
  approval`; `Ready to merge`. Append ` · auto-complete armed` when
  auto-complete is set.
- Footer counts: `ready` = state starts with `Ready to merge`; `waiting for
  author` = state is `Waiting for author`; `conflict` = state is
  `Merge conflict with main`; `pipeline` = state starts with `Pipeline`.
- No full descriptions, raw JSON, or URLs.

## Posting the open-PR list to Slack

Use this when the user asks to post their open PRs to the team. The user chose
this format on 2026-10-01. Keep it the same every time.

- Channel: `#<team-channel>`, unless the user names another.
- Include every active PR that has no approval yet. Apply Step 3a to drop safe
  auto-complete PRs. Also check `infra`.
- Send with `conversations_add_message` and the `blocks` parameter. NEVER use
  `content_type: text/markdown`: it puts all lines on one line and the message
  cannot be edited. Set `text` to `Open PRs from my side` as the fallback.
- `blocks` is one `rich_text` block with one `rich_text_section`. Its elements are
  `text` runs and `link` elements. The first run is `Open PRs from my side:\nPR `.
  Each PR number is a `link` element (`text` is the number, `url` is the PR URL).
  Each run after a link starts with ` - <repo> - <brief desc> (<TICKET>)` and ends
  with `\nPR `, except the last run.
- PR URL: `https://dev.azure.com/<ADO_ORG>/<ADO_PROJECT_URL_ENCODED>/_git/<repo>/pullrequest/<id>`.
  Keep any `%20` from the encoded project name.
- Visible result: a header line, then one line per PR:
  `PR <number as link> - <repo> - <brief desc> (<TICKET>)`. A paired PR gets
  `1/2, merge first` or `2/2` inside the brackets.
- Show the draft in a code block and wait for "send it". Show the draft only in the
  chat. The Slack message has no code fence.

## Boundaries

- Read-only. Never vote on, comment on, add reviewers to, or complete a PR
  from this skill without explicit user approval in the same session.
- Never post to Slack or ADO as a side effect of a status report.

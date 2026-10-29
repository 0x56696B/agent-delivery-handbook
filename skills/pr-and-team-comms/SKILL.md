---
name: pr-and-team-comms
description: Use after a PR is open, or when notifying the team. Covers finding a human reviewer, where the team actually talks (Slack #<team-channel> by default, #<tech-channel> for engineering-internal asks), replying to review threads, filing a bug from a review finding, and recording the vault decisions entry. For the PR itself (title, description templates, work-item link, reviewers, auto-complete) load pr-creation.
---

## The PR itself

`pr-creation` owns opening the PR: branch and title shape, the two
description templates, the forbidden-wording list, the work-item link, the
standing optional reviewers, and auto-complete safety. Load it before you
create a PR. This skill starts once the PR exists.

## Reviewer routing, as it really is

The official standard (ADO repo `<STANDARDS_REPO>`, file
`/Git Standards/README.md`) calls for a `/owners.md` file per repo with 2 or
more owners. As of 2026-09-17 no repo in this workflow's set has that file, so
treat the review-routing parts of the standard as aspirational. Use the Slack
fallback below to find a real reviewer.

## Finding a reviewer

No enforced CODEOWNERS-equivalent exists yet (no `/owners.md`). In practice:

- Check who authored recent PRs on the same repo (`repo_pull_request` action
  `list`) — they're a working reviewer for that codebase.
- Post the ask in `#<team-channel>` (the default channel — see "Where
  the team communicates" below), tagging the person by name. Historical
  examples predate the 2026-08-18 default change and were posted in
  `#<tech-channel>` (e.g. "if you're reviewing the orchestration PRs,
  just give me a shout, happy to give context/help get an auth token/show
  you the Swagger UI" — from a teammate, and "can someone review the PRs?" —
  from another teammate, both in that channel).

## Responding to review comments

When a reviewer leaves a comment on your PR:

1. Fetch the PR's threads (`repo_pull_request_thread` action `list`) and read
   the comment verbatim — don't work from a vault note or memory of it.
2. Re-verify every claim against the CURRENT code and live PR state before
   answering. Prior session notes go stale: re-read the worktree, re-fetch
   the PR. Cite file:line in your answer.
3. Reply in the same thread (`repo_pull_request_thread_write`, the existing
   thread id) — never a new thread for an answer. Then re-fetch the thread
   and confirm the comment really landed.
4. A reviewer finding that checks out as a real gap is a deliverable, not a
   footnote: file it in the vault, and if it needs work, file an ADO bug
   (next section) and say so in the thread reply so the reviewer sees it's
   tracked.
5. Update the task's vault page with the review status (who approved, what's
   open) and add a log entry.

## Filing a new bug from a finding

When a session confirms a real defect that has no ticket (reviewer question,
research finding, RESEARCH-00000 outcome):

1. Model the new work item on a recent real Bug from the same area: fetch one
   with `wit_work_item` (`expand: "all"`) and mirror its field layout — Area
   Path, Iteration Path, Repro Steps, Priority/Severity. Don't invent fields.
2. Draft the ticket in this shape and show the user before creating:
   - Title: what the user gets, in plain English. Not the cause.
   - Repro Steps: numbered steps; what happens; what should happen.
   - How QA checks it: the click path in the browser on dev or QA.
   - Three things the tester can tick off.
   - Screenshots attached.
   - Area Path per `rules/ado-area-path.md`; Iteration Path and
     Priority/Severity mirrored from the model bug; assigned to a named
     person.
   Create with `wit_work_item_write`; re-fetch and confirm state, Iteration
   Path, and board column. Do not trust the create call's response.
   `checkmarx-handling` uses this same shape.
3. Link it `Related` to the originating work item
   (`wit_work_item_link_write`), and re-fetch relations to confirm the link
   stuck.
4. If it came from a PR review comment, post the new bug's number back into
   that PR thread.

## Where the team communicates

- **Default channel: `#<team-channel>`.** Post here unless the user
  explicitly names a different channel for a specific message. This
  overrides the repo's own default-channel drift observed in the standards
  repo — set explicitly by the user on 2026-08-18.
- **`#<tech-channel>`** (Slack) — the engineering channel: review
  requests, infra-change announcements ("we will start pushing out some of
  the possibly disruptive infra changes into dev... please use this thread to
  report anything that is not working"), and links to the standards repo
  itself. Use this channel only when the user explicitly asks for it, or for
  a message that is inherently engineering-internal — flagging anything your
  change might disrupt for others running the same services.
- `#<all-teams-channel>` exists but is broader/product-facing — don't default to
  it for engineering review requests.
- **PR-open notification.** After a PR opens in `bug-workflow` or
  `story-workflow`, post to `#<team-channel>` at once. Do not show a
  draft and do not ask (user decision, 2026-10-21). One message per PR,
  even when one ticket has PRs in several repos. No @mentions: branch
  policy adds the reviewers. Exactly one line:
  ```
  PR <PRID> for review (<repo>): <summary> (<Bug|Story> <N>)
  ```
  - `<PRID>`: PR number, rendered as a link to the PR URL
    (`https://dev.azure.com/<ADO_ORG>/<ADO_PROJECT_URL_ENCODED>/_git/<repo>/pullrequest/<PRID>`).
  - `<repo>`: ADO repo name, e.g. `orchestrator`.
  - `<summary>`: the PR title with its Conventional Commits prefix
    (`type(scope): `) removed. Do not paraphrase.
  - `<Bug|Story> <N>`: the word `Bug` or `Story`, a space, the work item
    number. `<N>` is a link to
    `https://dev.azure.com/<ADO_ORG>/<ADO_PROJECT_URL_ENCODED>/_workitems/edit/<N>`.
    A returned bug's new PR (`fix/<slug>-<N>-r<n>`) appends ` (re-fix)`
    after the closing parenthesis.
  - A push to an already-open PR gets no post.
  Send it with the `blocks` parameter: one `rich_text` block with one
  `rich_text_section` whose elements are, in order:
  `{"type":"text","text":"PR "}`,
  `{"type":"link","url":<PR URL>,"text":"<PRID>"}`,
  `{"type":"text","text":" for review (<repo>): <summary> (<Bug|Story> "}`,
  `{"type":"link","url":<work item URL>,"text":"<N>"}`,
  `{"type":"text","text":")"}` (plus `{"type":"text","text":" (re-fix)"}`
  for a re-fix). Set `text` to the plain line as the notification
  fallback. Do not use `<url|label>` mrkdwn or bare URLs: they did not
  render as links. Example (plain view):
  ```
  PR 4567 for review (orchestrator): stop generate_image for slide and document pictures (Bug 12345)
  ```
  After the post, read `conversations_history` for the channel and confirm
  the message is there. Report the timestamp. If the post call fails,
  retry once after checking history shows no copy; then report.
- Any other Slack post (review asks, disruption notices, DMs): show a draft
  in a fenced code block and post only after approval. Don't post secrets,
  tokens, or `.env` contents.

**Links in Slack messages**: post links as `rich_text` `link` elements in
`blocks` (see "PR-open notification"). `<url|label>` mrkdwn and bare URLs
sent via the MCP tool did not render as clickable links (seen 2026-10-21).
ADO URLs contain `%20` when the project name has spaces; never un-encode them.

**Multi-line posts**: use the `blocks` parameter with one `rich_text` /
`rich_text_section`. `content_type: text/markdown` collapses the lines into
one, and a post cannot be edited. Test a new layout first as a DM to the user
(`users_search` gives the DM channel id).

## Record the decision in the vault

For each repo with a real code change, add one page
`vault://wiki/decisions/YYYY-MM-DD-<slug>.md` from
`vault://wiki/templates/decision.md` (ADR format: Decision, Context,
Reasoning, Consequences), with `project` linking the project page. If you
learn a durable fact about a library or framework — not specific to this one
ticket — add it as its own short page in `vault://wiki/notes/`, marked as a
reusable fact, not a ticket note. If two repos needed a coordinated fix,
link their decision pages to each other.

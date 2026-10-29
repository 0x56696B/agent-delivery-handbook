---
description: 'Never mark another person''s PR comment thread as Fixed/Resolved; only the thread author resolves it'
condition: "\"action\":\\s*\"update_status\""
scope: "tool:mcp__azure_devops_repo_pull_request_thread_write"
interruptMode: never
---

# PR comment thread resolution

Do not set a pull request comment thread's status to `Fixed`, `Closed`, or
`WontFix` when the thread's original comment author is someone else.

When you address a review comment from another person:

- Push the fix and reply in the thread with the commit reference.
- Leave the thread status as `Active`.
- Let the original author change the status once they confirm the fix.

This applies to `repo_pull_request_thread_write` action `update_status` on
any thread you did not start. Set by user instruction, after a
thread on PR 4567 (BUG-12345, `web-app`) was marked Fixed on a teammate's
comment and had to be reverted to Active.

One exception: `pr-merge` sets `Closed` on a `superseded` thread (every other
commenter has approved after their last comment on it) and on a chit-chat
thread (praise or thanks only) that the author answers "Close". It does so
only inside its one combined ask, right before the merge. No other skill or
flow may close another person's thread.

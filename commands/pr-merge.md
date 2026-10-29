---
description: "[pr-number] · Merge my PR when its gates pass, then move the ticket and close the vault task. No number: list my mergeable PRs and let me pick"
---

Merge PR `$1`.

Read `skill://pr-merge`. If `$1` is a PR number, run the single-PR flow
for it. If `$1` is empty, run the scan flow.

Follow the skill exactly. Do not restate its steps back to me.

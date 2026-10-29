---
description: "<ticket-number> · Work an ADO Bug end to end"
---

Work Bug $1.

1. Read `skill://workflow-router` for the routing map.
2. Read `skill://ticket-bootstrap` and bootstrap ticket $1.
3. Read `skill://bug-workflow` and run the bug flow. It opens the PR without asking once its verification passes, then posts the fixed PR-open Slack line with no draft and no approval (a draft PR posts nothing). Any other Slack post needs a draft first. If bootstrap flagged a returned bug ("Detect a returned bug"), start at the bug skill's "Returned bug" step.

Follow the skills exactly. Do not restate their steps back to me.

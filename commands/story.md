---
description: "<ticket-number> · Route an ADO User Story to refinement or implementation by its state"
---

Work User Story $1.

1. Read `skill://workflow-router` for the routing map.
2. Fetch ticket $1 with the Azure DevOps MCP work-item tool and read its state.
3. State `Ready for Development` or later: read `skill://story-workflow` and
   run Session B.
   Session B opens the PR without asking once its verification gate passes,
   releases every resource it used, then posts the fixed PR-open Slack line
   with no draft and no approval (a draft PR posts nothing). Any other Slack
   post needs a draft first.
4. State `Backlog` or `In Refinement`: read `skill://story-refinement` and
   run Session A.

---
description: 'Set System.AreaPath to <AREA_PATH> on every ADO work item you create or edit'
condition: "\"action\":\\s*\"(create|update|update_batch)\""
scope: "tool:mcp__azure_devops_wit_work_item_write"
interruptMode: never
---

# Area Path convention

For every Azure DevOps work item created or edited in the `<ADO_PROJECT>`
project (org `<ADO_ORG>`), set `System.AreaPath` to:

```
<AREA_PATH>
```

Applies to new work items you create (bugs, stories, tasks) and to any
existing item whose Area Path you touch.

## Temporary override

This value is temporary. The team works on a different board for now.

| | Area path |
|---|---|
| Current | `<AREA_PATH>` (the temporary board) |
| Previous | `<PREVIOUS_AREA_PATH>` (the team's regular board) |

Restore the previous value when the team returns to the regular board.
Original rule set by user instruction. Temporary override set later by user
instruction.

Set the field with the `wit_work_item_write` MCP tool (`create`, `update`, or
`update_batch`) and field name `System.AreaPath`. Re-fetch after the write to
confirm the value stuck, per the standard ADO-write verification rule.

Historically done via `az rest --method patch` on the work-item REST
endpoint. That path is now blocked by `azure-cli-fallback`: the MCP tool
covers this operation, so `az` is not a valid route for it any more.

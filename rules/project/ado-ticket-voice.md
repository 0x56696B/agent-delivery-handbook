---
description: 'Write ADO ticket body text in plain, first-person phrasing'
condition: "System\\.(Description|Title)"
scope: "text, tool:mcp__azure_devops_wit_work_item_write"
interruptMode: never
---

# ADO ticket voice

Write the body text of Azure DevOps work items (`System.Description`,
`Microsoft.VSTS.Common.AcceptanceCriteria`, comments) in plain, first-person
phrasing, as if the requesting engineer wrote it directly. Avoid a
report-style, third-person, "the investigation found" tone.

This is a writing-style instruction only. It does not change the
per-claim source citations a ticket carries. Only the surrounding prose
voice changes.

Set by user instruction.
Scope widened to `text, tool` later, so this rule can fire while a
ticket's body text is drafted in chat, not only when `wit_work_item_write`
is actually called. Originally `scope: "tool"` matched only the write call
itself, after drafting was already done.

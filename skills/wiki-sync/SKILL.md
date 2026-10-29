---
name: wiki-sync
description: Use when the user asks to sync the vault with ADO, reconcile the board, pull new assigned work items, or check for status drift.
---

## When
- The user asks to sync the vault with ADO.
- The user asks to check board drift or pull new assigned items.
- The user asks for a periodic reconciliation pass.

## Inputs
- Task pages under `vault://wiki/tasks/`.
- Project pages under `vault://wiki/projects/` (`ado_project`, `ado_states`).
- The task template at `vault://wiki/templates/task.md`, for full frontmatter on pulled tasks.
- ADO read routes: `wit_query`, `wit_backlog`, `work`, `search_workitem`, `wit_work_item`, `repo_pull_request`.
- ADO write route: `wit_work_item_write`.

## Steps
1. Load state mappings. For each project page with a non-null `ado_project`, read its `ado_states` frontmatter key. If it is missing, query the project's work item states with `work` or `wit_query`. Write the real state names into `ado_states`. Reuse this mapping on every later sync.
2. Push the vault to ADO. The vault always wins. For each task with a non-null `ado_id`, read the current ADO state with `wit_work_item`. Map the task `status` through `ado_states` and compare the two values.
   - If the task status maps to a state other than review or done, and the states differ, update ADO now with `wit_work_item_write`.
   - If the task status maps to a review or done state, use the Gate below before you update ADO.
   - Never change the vault `status` from this comparison.
   - Copy the item's iteration path into `sprint` and its due date into `due`, on every sync. Status stays vault-owned. Only `sprint` and `due` come from ADO.
3. Close reviewed tasks. List tasks with `status: review`. For each one, check the pull request state with `repo_pull_request`.
   - If the pull request merged, use the Gate below. Then set `status: done` and `completed` to today's date. Move the ADO item to its mapped done state. Append the log entry for the close.
   - If the pull request is open or abandoned, leave `status: review`.
4. Pull new assigned items. Query ADO with `wit_query` or `search_workitem` for items that name the user. Keep the items with no matching `ado_id` in any vault task.
   - For each new item, create a task page at `vault://wiki/tasks/<slug>.md` from `vault://wiki/templates/task.md`.
   - Set `created` to today's date, `priority: p3`, and `status: inbox`. Set the item's `ado_id`, `ado_state`, and `project` (a wikilink to the matching project). Leave every other field null.
   - Add the line "Origin: pulled from ADO on YYYY-MM-DD." under `## Notes`.
   - Add an entry for the new task page to `vault://wiki/index.md`, under the Tasks heading.
5. Triage inbox tasks. List every task with `status: inbox`. Show the list to the user.
   - Ask which tasks to promote to `status: todo`, and the `priority` for each.
   - Never promote a task without the user's answer.
6. Flag drift in two cases: a push in step 2 fails, or the ADO state differs from the state the vault expects. Do not change the vault frontmatter. Append a `## Drift` section to the task body with the vault status, the ADO state, and the date detected.
7. Report a summary to the user: counts pushed, pulled, closed, promoted, and flagged as drift. Link every touched task page.
8. Append the log entry (see `## Log`) to `vault://wiki/log.md`.

## Gates
- A push moves an ADO item to a review or done state. Show the task and the new ADO state. Wait for approval.
- Before you close a task: show the task and the merged pull request. Wait for approval.
- Before you promote any inbox task: show the list of inbox tasks. Wait for the user's choice of tasks and priority.

## Writes
| Page/file | Fields changed |
|---|---|
| `vault://wiki/projects/<slug>.md` | `ado_states` (recorded on first sync) |
| `vault://wiki/tasks/<slug>.md` (existing, push) | `sprint`, `due` (copied from ADO) |
| `vault://wiki/tasks/<slug>.md` (existing, close) | `status: done`, `completed` |
| `vault://wiki/tasks/<slug>.md` (new, pulled) | new page: `type`, `created`, `priority`, `status: inbox`, `ado_id`, `ado_state`, `project`, nulls for the rest, body line under `## Notes` |
| `vault://wiki/tasks/<slug>.md` (triage) | `status` (inbox→todo), `priority` |
| `vault://wiki/tasks/<slug>.md` (existing, drift) | body `## Drift` section appended |
| `vault://wiki/index.md` | new entry for each pulled task page, under the Tasks heading |
| `vault://wiki/log.md` | appended entry |

## Log
```
## [YYYY-MM-DD] sync | ADO reconciliation
- Pushed <n> task(s) to ADO; pulled <n> new task(s): [[<task page>]], ...
- Closed <n> task(s); promoted <n> task(s) from inbox to todo.
- Flagged drift on <n> task(s): [[<task page>]], ...
```

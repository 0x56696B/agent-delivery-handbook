---
name: tool-gotchas
description: "Known traps in ADO MCP, read/grep/glob, bash, and todo tools in the tasks workspace, with the fix for each"
alwaysApply: true
---

# Platform: tool gotchas

Each bullet is one trap that cost time before. Apply the fix before the call.

- `wit_work_item_attachment`: run `mkdir -p` on the target directory first.
  The tool resolves a relative `savePath` against the tasks root, not the
  session cwd. Pass `<task-folder>/docs/attachments` relative to the tasks
  root, or an absolute path.
- `wit_work_item` (every action): pass `project: "<ADO_PROJECT>"`. Without
  it, the call fails with "Client does not support form elicitation".
- Task-folder repo entries are symlinks. The tools treat them differently:
  - `read` follows them for files and directories. Use
    `read <task>/<repo>/<path>` and `read <task>/<repo>`, not `ls` or
    `cat`. The `main/` worktrees are current only after someone pulls.
    For the latest `main`, fetch, then run `git show origin/main:<path>`.
  - `glob` follows them when `path` starts at the symlink or below it:
    `glob <task>/<repo>/**/*.ts`. A glob that starts above the symlink,
    such as `<task>/**/*.ts`, does not enter the repo.
  - `grep` works when `path` is a real directory or a file below the
    symlink, such as `<task>/<repo>/src`. When `path` is the symlink
    itself (`<task>/<repo>`, with or without a trailing `/`), `grep`
    returns "No matches found" for text that exists. No setting changes
    this. To search a whole repo, use `git -C <task>/<repo> grep`.
  - Never search the resolved `*-bare` path; rule
    `no-parent-folder-repo-access` forbids it.
- `read` of a `/tmp/...` path fails. Use `/private/tmp/...`.
- Commands that run longer than 300 s: pass `timeout`, or start them with a
  bash `name`. `async: true` does not lift the 300 s limit.
- `todo` op `done` with only `phase` marks every pending task in that phase as
  done. Pass one `task`.
- ADO MCP `list_comments` strips angle-bracket tags from comment text. Write
  tag names without brackets.
- After any ADO write, re-fetch the item and check the field. MCP `update`
  with `autoComplete: false` leaves `autoCompleteSetBy` set. Clear it with
  `az repos pr update --id <id> --auto-complete false --org "https://dev.azure.com/<ADO_ORG>/"`.
- User Story state moves: move one neighbouring state at a time. A jump
  returns HTTP 400, although `get_type` shows all-to-all transitions.
- `az rest --body @file` corrupts binary attachments. Use
  `curl --data-binary @file -H "Content-Type: application/octet-stream"` with
  a token from
  `az account get-access-token --resource <ADO_RESOURCE_ID>`
  (the well-known Azure DevOps resource application ID).
  Then compare the `resourceSize` in the response with the local file size.
  To undo a bad upload, remove the `AttachedFile` relations by index, highest
  index first, with a `test /rev` guard.

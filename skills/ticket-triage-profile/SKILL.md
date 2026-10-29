---
name: ticket-triage-profile
description: Project binding for the ticket-triage skill in the platform workspace. Azure DevOps calls, field targets per work item type, state moves, and code locations. Read only from ticket-triage.
---

# Project profile for ticket-triage

Read this skill only from `skill://ticket-triage`. Each section below matches a section name that the generic skill requires.

## Pre-flight

1. Ticket IDs are numeric. If the ID is not all digits, stop and tell the user.
2. Use `glob` for `*-<ID>-*` in `~/work/<PROJECT>/tasks`.
3. If a folder exists, follow `.omp/RULES.md`: call `move_session` with the folder name. Then run the two setup scripts as `.omp/RULES.md` says.
4. If no folder exists, stay at the tasks root.
5. Never run `setup-task-branch.sh` to create a folder for triage.

## Fetch

Org and project: see `.omp/AGENTS.md`. On an MCP failure, follow the `azure-cli-fallback` rule: log in, then retry the MCP call.

1. `wit_work_item` action `get`, with `expand: "Relations"`. Capture these fields: `System.WorkItemType`, `System.Title`, `System.State`, `System.Description`, `Microsoft.VSTS.TCM.ReproSteps`, `Microsoft.VSTS.TCM.SystemInfo`, `Microsoft.VSTS.Common.AcceptanceCriteria`, `Custom.Background`, `Custom.NFR`, area path, iteration path, tags, `multilineFieldsFormat`, and `rev`.
2. `wit_work_item` action `list_comments`.
3. `wit_work_item` action `get_batch` for the IDs of linked work items.
4. For each image attachment: run `mkdir -p ~/work/<PROJECT>/tasks/tmp/triage-<ID>` with `bash` (the download tool does not create the folder). Then call `wit_work_item_attachment` with `savePath: "tmp/triage-<ID>"`. The tool resolves a relative path against its own working directory, which is the tasks root. Read the saved file at `~/work/<PROJECT>/tasks/tmp/triage-<ID>/<fileName>`. If the file is not there, use `glob` on the file name to find it.
5. `User Story` in `Backlog`: move it to `In Refinement` now, as `## State moves` says. Re-fetch to confirm.

## Code locations

- Main worktrees: `~/work/<PROJECT>/<repo>-bare/main` for the in-scope repos in `AGENTS.md`.
- The `main` worktree can be stale. Bare repos have no fetch refspec, so a plain fetch does not update `origin/main`. Before you scout, run `git -C ~/work/<PROJECT>/<repo>-bare fetch origin main:refs/remotes/origin/main`. Tell each scout to read `origin/main` (`git show origin/main:<path>`, `git grep <pattern> origin/main`), not the worktree files. Do not reset the worktree.
- Always exclude `legacy-agent`.
- `infra` is Terraform only.

## Knowledge sources

None beyond the vault. The generic skill already reads the vault.

## Spec targets

| Work item type | Target | Spec heading |
|---|---|---|
| `Bug` | Work item comment | `## Triage Specification` |
| `User Story` | Work item comment | `## Agent Contract (Ready for Development)` |
| any other type | Work item comment | `## Triage Specification` |

Every type writes to a comment, so the original ticket text stays unchanged. For a User Story, the heading text and the six subsections must match exactly: Acceptance criteria, Resolved questions, Affected repos, Verification plan, Deploy-order notes, Stop conditions. `story-workflow` Step 0 reads the contract from the description or from a comment, so it accepts the ticket. `story-refinement` becomes optional.

## Write rules

- Comment: `wit_work_item_comment_write` action `add`, or action `update` with the `commentId` from `list_comments`. Use `format: "Markdown"`. `~/.omp/agent/extensions/tool-approval-gate.ts` posts it with no prompt when the `tool-call-auditor` model answers SAFE; otherwise it shows a prompt with the verdict.
- Never write to a description field in triage.
- Never put angle-bracket tags (for example `<transcript>`, `<attached_document>`) in spec text, not even inside backticks. ADO stores them, and the web view renders them, but the ADO MCP `list_comments` `text` strips them, so a later session that reads the contract through the MCP sees empty backticks. Write the tag name without brackets: "the `transcript` tag". Check the re-fetched `text`, not the write response.

## State moves

- `Bug` in `New`: offer `Ready for Triage`. Do not offer `Ready for Fix`: `bug-workflow` Step 2 makes that move after it reproduces the bug.
- `User Story`: do not offer; move directly. At triage start (right after Fetch), move a `Backlog` story to `In Refinement`. After the user approves the contract and the re-fetch confirms the comment, move it to `Ready for Development`.
- No other offers.
- Write with `wit_work_item_write` action `update`, path `/fields/System.State`. Then re-fetch.

## Next step

- Link: `https://dev.azure.com/<ADO_ORG>/<ADO_PROJECT>/_workitems/edit/<ID>`
- `Bug`: `/bug <ID>`
- `User Story`: `/story <ID>`
- Split-off stories: if the grill moved scope to a new ticket, then after this ticket's contract is written and verified, draft each new User Story (title, description, acceptance criteria, area path per `ado-area-path`, a related link to this ticket). Show the draft and create it only after approval. Then re-fetch and report its ID.

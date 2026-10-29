---
name: wiki-task-loop
description: Use when the user asks to work a task, pick up the next task, continue the dev loop, or names a task page or ADO work item to implement.
---

## When
- The user asks to start or continue development on a task.
- The user names a task page or an ADO work item id.
- The user asks to "work the next task" or "pick up a task".

## Inputs
- Optional: a task slug, title, or ADO id named by the user.
- Task pages under `vault://wiki/tasks/`.
- Project pages under `vault://wiki/projects/` (`repo_path`, `ado_repo`, `default_branch`, `ado_states`).
- ADO routes: `wit_work_item`, `wit_work_item_write`, `work`, `wit_query`, `repo_pull_request_write`.
- A local checkout of the target repo, and `git` in a shell for branching, committing, and pushing.

## Steps
1. Select the task. If the user names one, open it at `vault://wiki/tasks/<slug>.md`. Else list `vault://wiki/tasks/` and keep pages with `status: todo`. Pick the highest priority page (p1, then p2, then p3). Break ties with the oldest `created` date. Report and stop if no todo task exists.
2. Edit the task frontmatter: set `status: doing`. Change no other field yet.
3. Ensure the ADO work item exists. Read `ado_id` on the task.
   - If `ado_id` is null: read the linked project page for `ado_project`, then create the item with `wit_work_item_write`. Write the returned id into `ado_id` and the returned state into `ado_state`.
   - If `ado_id` is set: read the project's `ado_states` frontmatter key. If it is missing, query the project's work item states with `work` or `wit_query`. Write the real state names into `ado_states` on the project page. Move the item to the mapped in-progress state with `wit_work_item_write`. Write the new value into `ado_state`.
4. Resolve the repo from the project page: `repo_path`, `ado_repo`, and `default_branch`. If `ado_repo` or `repo_path` is null, ask the user once for both. Write the answers to the project page.
5. Create a branch named `task/<slug>` in the checkout, before any edit. Write `branch` and `started` to the task frontmatter now.
6. Implement the change in the repo at `repo_path`. Debug and test the change end to end, using the repo's own build and test commands. Follow the repo's conventions, not the vault's.
7. Commit the work and push the branch `task/<slug>` with git.
8. Write a decision page at `vault://wiki/decisions/YYYY-MM-DD-<slug>.md` for each design or scope decision you make. Link it to the task and the project. Add an entry for the decision page to `vault://wiki/index.md`, under the Decisions heading.
9. GATE. Show the diff to the user. One approval covers three effects: the pull request, the ADO review-state move, and the `status: review` write. Wait before any of the three. This gate is for work outside a ticketed task folder. For a ticketed task inside the tasks root the project rules win: the PR opens with no prompt once its verification gate passes, and tracker moves follow the project's exception list.
10. After approval, open a pull request with `repo_pull_request_write`. Set the source branch to `branch` and the target branch to the project's `default_branch`. Do not call `repo_create_branch`; the git push already created the remote branch.
11. Edit the task frontmatter: set `pr` to the pull request URL and `status: review`.
12. Move the ADO work item to the project's mapped review state with `wit_work_item_write`. Write the new value into `ado_state`.
13. GATE. Draft a short Slack update on the task (see `skill://wiki-comms`). Show the draft to the user and wait for approval before any send.
14. Append the log entry (see `## Log`) to `vault://wiki/log.md`.

### Failure handling
A blocker stops the task: a missing decision, a broken dependency, or an environment fault. Then do this instead of steps 7 onward:
1. Append a `## Blocker` section to the task page body. State the blocker in one or two sentences and name what you tried.
2. Leave `status: doing`. Do not set `review` or `dropped`.
3. Report the blocker to the user, with the blocker text and what you tried.
4. Append a log entry under `op: task` that names the blocker.

## Gates
- One gate covers three effects: the pull request, the ADO review-state move, and the `status: review` write. Show the diff. Wait for approval before any of the three.
- Before sending any Slack update: show the draft, wait for approval.

## Writes
| Page/file | Fields changed |
|---|---|
| `vault://wiki/tasks/<slug>.md` | `status` (todo→doing→review, or stays doing on a blocker), `started`, `branch`, `ado_id`, `ado_state`, `pr`, body (`## Blocker` on failure) |
| `vault://wiki/projects/<slug>.md` | `repo_path`, `ado_repo`, `default_branch` (asked once, if null), `ado_states` (bootstrapped, if missing) |
| `vault://wiki/decisions/YYYY-MM-DD-<slug>.md` | new page, fields per `vault://wiki/schema.md` |
| `vault://wiki/index.md` | new entry for each decision page, under the Decisions heading |
| `vault://wiki/log.md` | appended entry |

## Log
```
## [YYYY-MM-DD] task | <task title>
- Set <task title> to doing/review; ADO #<ado_id> moved to <ado_state>.
- Opened pull request <pr url> from branch <branch>. (omit on a blocker)
- Filed decisions: [[<decision page>]], ... (omit if none)
- Blocker: <one-line blocker text> (only on a blocker)
```

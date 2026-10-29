# RULES.md — <PROJECT>

- Start every session with the working directory
  `~/work/<PROJECT>/tasks`. Project rules and the Azure DevOps, Slack, and
  Playwright MCP servers load from `<cwd>/.omp` only. A session started
  in a repo worktree, or in a task folder with no `.omp` link, loses
  them. Reach each repo through its task-folder symlink, and run git
  with `git -C <repo>`.
- When you pick up a ticket, move the session into its task folder
  before any other work on it. This applies to every request about the
  ticket, including a status check, a comment review, or a PR comment
  fix. Find the folder with `glob` on `*-<NUM>-*`. If it exists, call
  `move_session` with the folder name first. If it does not exist, stay
  at the tasks root: bootstrap creates the folder and moves at the end of
  its Step 4b. A User Story gets no folder before Session B passes its
  contract gate, so story refinement stays at the tasks root. The move keeps the MCP
  servers, because each task folder links the shared `.omp`. After the
  move, run `setup-task-branch.sh` and `setup-task-lsp.sh` with the bash
  `cwd` set to `~/work/<PROJECT>/tasks`. A subagent cannot move; it uses
  explicit task-folder paths.
- After `setup-task-branch.sh` runs, never remove a task-folder symlink and
  never delete a branch or worktree it created. Leave every repo linked,
  including out-of-scope repos, because later testing may need them. The
  `legacy-agent` exclusion is the only one: the script skips it itself. Only
  a user instruction in the current session lifts this rule.
- Ask before you move an ADO item to a review or done state. Exceptions,
  decided on 2026-10-16: the agent writes `Resolved` (Bug) and `Ready for Test`
  (Story) without a prompt once every linked PR is merged, and `Ready for
  Retest` (Bug) and `In Test` (Story) without a prompt once
  `tasks-deployed-to-qa` proves the fix is on QA. The triggering fact is
  re-fetched and recorded before the write. The agent never writes `Closed`,
  `Pending PO Review` or `Accepted`; those belong to the tester or the PO.
- Ask before you comment on an ADO work item.
- Ask before you modify an ADO work item, except for an area-path change,
  an iteration-path change, assigning the item to yourself, the four state
  moves listed in the review-or-done bullet above, and a state move that a
  skill tells you to make. Those writes need no prompt.
- When a loaded skill tells you to move a work item to a state, move it
  without a prompt. Re-fetch the item and check the state after the write.
  This does not cover `Closed`, `Pending PO Review` or `Accepted`.
- Show a Slack draft and wait for approval before you post. Exception: the PR-open notification in `pr-and-team-comms` posts without a draft or approval. The post call itself has no tool prompt.
- Show any proposal, quote, or draft (a Slack message, a PR description,
  ticket text, etc.) in a fenced code block, always, so it is visually
  distinct from your own prose and cannot be mistaken for an action
  already taken.
- Before starting any local service, check the port with `lsof`. If
  another process already owns it, never stop, kill, or restart that
  process, even with the user's live authorization. Pick a different
  port instead, or ask the user to coordinate with the other session's
  owner. See `service-startup-reference` for the full procedure.
- On someone else's PR, a review vote is not merge authorization.
  Before casting `Approved` or `ApprovedWithSuggestions`, check whether
  their auto-complete is armed and whether the vote would satisfy the
  last blocking policy. If it would trigger the merge, ask first.
- The ask-before gates above are enforced in `.omp/config.yml`, which sets
  `prompt` on the Azure DevOps write tools. The prose bullets state
  the intent. The config makes the harness stop the call.
- Work-item field writes are the one exception. `tools.approval` carries no
  policy for `mcp__azure_devops_wit_work_item_write`. The
  `toolApprovalConditions` block decides, and the global gate
  `~/.omp/agent/extensions/tool-approval-gate.ts` applies it. Defaults are in
  `~/.omp/agent/config.yml`, and the block in `.omp/config.yml` overrides
  them. The fallback is `allow`, so the agent must ask in chat before a
  state, title, or description write. The gate does not prompt for those
  writes.
- `.omp/extensions/process-ownership-guard.ts` enforces the port rule.
  It blocks `hub` stop, restart, and stop signals, and `omp ps`
  stop/kill/restart, on a process name this OMP process did not start. It
  also blocks `pkill`, `killall`, `xargs kill`, and a `kill` of a PID
  outside this session. You stop a foreign orphan yourself with
  `omp ps stop <name>` in your own terminal.

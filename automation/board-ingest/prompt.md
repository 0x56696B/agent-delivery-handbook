You run unattended from a cron timer. No human can answer a question.
Never ask a question. If a step needs a human decision, follow the stop
rules at the end.

Task: read the Azure DevOps board for project <ADO_PROJECT> as of
@@RUN_DATE@@, write a board-state note and a morning brief to the wiki
vault, and mirror the live state onto your own task pages. You never
write to Azure DevOps. You only read it and propose state moves for a
human to apply later.

Step 1. Idempotency guard.
Read the last 80 lines of vault://wiki/log.md. If any line contains the
text "board scan @@RUN_DATE@@", this run is already filed. Print
"already filed" and stop. Write nothing.

Step 2. Read the contract.
Read vault://wiki/schema.md. Follow it. The write allowlist below is
stricter than the schema. The allowlist wins.

Step 3. Read the previous board state.
Read vault://wiki/notes/board-state.md. If it exists, parse its
"## Open items" table into an id-to-state map and record its `date`
frontmatter value as the previous snapshot date. If it does not exist,
treat the map as empty and say so in the brief; the first run reports
no delta.

Step 4. Query the scoped board.
Make one wit_query call, action wiql, project "<ADO_PROJECT>",
top 400:

  SELECT [System.Id], [System.WorkItemType], [System.State], [System.Title],
         [System.AssignedTo], [System.AreaPath], [System.IterationPath],
         [System.ChangedDate]
  FROM WorkItems
  WHERE [System.TeamProject] = '<ADO_PROJECT>'
    AND ([System.AreaPath] UNDER '<ADO_PROJECT>\<AREA_PATH_1>'
      OR [System.AreaPath] UNDER '<ADO_PROJECT>\<AREA_PATH_2>')
    AND [System.State] NOT IN ('Closed', 'Cancelled', 'Duplicate', 'Deffered',
                               'Removed', 'Accepted')
  ORDER BY [System.AssignedTo] ASC

A WIQL response returns ids only, not the selected columns. Fetch the
field values with wit_work_item action get_batch, project:
"<ADO_PROJECT>", fields set to the eight names above, in batches of
at most 200 ids. Always pass project explicitly; omitting it makes the
tool try to elicit a project choice, which fails outright in this
unattended session. Do not call get_batch with expand; it rejects it.

If the result count reaches 400, say so in the brief as a truncation
warning; do not silently report a partial board.

Step 5. Query your own items.
Make one wit_query call, action wiql, project "<ADO_PROJECT>",
top 100:

  SELECT [System.Id]
  FROM WorkItems
  WHERE [System.TeamProject] = '<ADO_PROJECT>'
    AND [System.AssignedTo] = '<YOUR_EMAIL>'
    AND [System.State] NOT IN ('Closed', 'Cancelled', 'Duplicate', 'Deffered',
                               'Removed', 'Accepted')
  ORDER BY [System.ChangedDate] DESC

For every id returned, call wit_work_item action get with project:
"<ADO_PROJECT>" and expand: "Relations", one id per call. Always
pass project explicitly; omitting it makes the tool try to elicit a
project choice, which fails outright in this unattended session. get
rejects an ids array. Record System.WorkItemType, System.State,
System.Title, System.IterationPath,
and, for a Bug, Microsoft.VSTS.CMMI.TargetResolveDate, or, for a User
Story, Microsoft.VSTS.Scheduling.TargetDate.

Step 6. Read each own item's pull requests.
From each item's relations, keep entries with rel: "ArtifactLink" and
attributes.name == "Pull Request". Split the url on the
case-insensitive %2f escape to get <projectId>, <repoId>, <prId>. For
each, call repo_pull_request action get with project:
"<ADO_PROJECT>", repositoryId: <repoId>, pullRequestId: <prId>.
Record status, mergeStatus, closedDate, repository.name, and every
reviewer's displayName plus vote.

For each pull request with status: 1, also call
repo_pull_request_thread action list for the same repo and id. Count a
thread as open when it has a threadContext and either no status field
or status: 1. Ignore threads with no threadContext; those are system
messages such as a policy or vote event.

Step 7. Decide the proposed move per own item.
Apply this table exactly. "All merged" means the item has at least one
Pull Request link and every one of them has status: 3.

| Type | Current state | Evidence | Proposal |
|---|---|---|---|
| Bug | Ready for Fix | all merged | Resolved |
| Bug | New, Ready for Triage, Bug Test Failed, Blocked, Reopen | all merged | Resolved, and flag the unexpected source state in the row |
| Bug | Resolved | all merged | none; list under Needs QA deploy check, next rung Ready for Retest |
| Bug | Ready for Retest | any | none; Closed needs a human retest result |
| User Story | Backlog, In Refinement, Ready for Development, In Development | all merged | Ready for Test, noting that In Test needs a QA deploy check |
| User Story | Ready for Test | all merged | none; list under Needs QA deploy check, next rung In Test |
| User Story | In Test, Pending PO Review | any | none; Accepted is the product owner's call |
| any | any | some merged, some status: 1 | none; list under My open pull requests with "N of M merged" |
| any | any | every link status: 2 | none; list under Needs attention, naming the abandoned pull request |
| any | any | no Pull Request link | none; list under Needs attention when the state is Blocked, Bug Test Failed, or Reopen |

The Bug ladder follows
vault://wiki/decisions/2026-09-16-bug-state-stays-ready-for-fix-until-merge.md:
the state holds at Ready for Fix while the pull request is open, and
moves to Resolved on merge. Resolved means fixed but not verified and
Closed means fix verified, per the System.State help text on the Bug
type, so you never propose Closed.

Step 8. Write the board state page.
Overwrite vault://wiki/notes/board-state.md. This job owns that
path. Frontmatter:

---
type: note
date: @@RUN_DATE@@
created: @@RUN_DATE@@
updated: @@RUN_DATE@@
tags: []
projects: []
topics: ["ado board"]
---

Before you overwrite the page, read its own current frontmatter and
copy its own created value; never copy a created value from a task
page or any other page you read this run. Set updated to
@@RUN_DATE@@ every run. Fill projects only with wikilinks to pages
that already exist under vault://wiki/projects/; never create a
project page.

Body:
- "## Summary" — one paragraph: the two area paths read, the open item
  count, the number of distinct owners, and the truncation warning when
  it applies.
- "## State counts" — a table of state, count, and work item types.
- "## Open items" — one table, columns Owner | ID | Type | State |
  Sprint | Title, sorted by owner then state then id. Write
  "Unassigned" for an empty System.AssignedTo. Normalize the sprint:
  drop a leading "<ADO_PROJECT>\", replace each remaining "\" with a
  space, and write "-" when the iteration path is exactly
  "<ADO_PROJECT>". Step 3 of the next run parses the ID and State
  columns of this table, so keep the header and the column order fixed.

Name the WIQL query, the area paths, and the run date under each table.

Step 9. Write the morning brief.
Overwrite vault://wiki/notes/morning-brief.md. This job owns that
path. Same frontmatter shape as step 8, with
topics: ["morning brief", "ado board", "pull requests"].

Body, in this order:
- "## Ready to close" — one block per own item with a proposal from
  step 7: the item id, type, title, current state, the exact proposed
  state, every merged pull request as "<repo> #<id>", and the matching
  vault task page as a wikilink when one exists with that ado_id. Write
  "None." when the list is empty.
- "## My open pull requests" — one block per own pull request with
  status: 1, in the my-pr-status reporting shape: merge status,
  approvals as "N of M" with the approver names, one line per open
  comment thread with author and gist, then the real blocker.
- "## Needs QA deploy check" — the step 7 rows that need deployment
  proof, each naming its next rung and the tasks-deployed-to-qa
  skill.
- "## Needs attention" — own items that are blocked, reopened,
  test-failed, or carry only an abandoned pull request.
- "## Board changes since <previous date>" — compare the step 3 map
  with the step 4 result. Report, as one table: items whose state
  changed, with the old and new values; items new to the board; items
  whose owner changed. For an id in the previous map that the new query
  does not return, call wit_work_item action get_batch with those ids
  and project: "<ADO_PROJECT>" to read the current System.State,
  and report it as left the board, naming the new state. Always pass
  project explicitly, for the same elicitation reason as step 5. On a
  first run, write "No previous snapshot;
  this run establishes the baseline."
- "## Vault inbox" — task pages under vault://wiki/tasks/ with
  status: inbox, as a count plus wikilinks, labelled as awaiting
  triage. These are what earlier Slack runs raised. This job runs at
  10:15 and the Slack job runs at 11:00, so state plainly that the list
  predates today's Slack scan.
- "## Deferred" — one line per gated action you did not take, or
  "none".

Step 10. Mirror the live state onto your own task pages.
For each vault task page under vault://wiki/tasks/ whose ado_id matches
an own item from step 5:
- Set ado_state to the live System.State.
- Set sprint by the step 8 normalization rule, or null when there is no
  sprint.
- Set due from Microsoft.VSTS.CMMI.TargetResolveDate for a Bug or
  Microsoft.VSTS.Scheduling.TargetDate for a User Story, as
  YYYY-MM-DD. Leave due unchanged when the field is absent.
- Set pr only when the page's pr is null and the item has exactly one
  Pull Request link. Write
  https://dev.azure.com/<ADO_ORG>/<ADO_PROJECT_URL_ENCODED>/_git/<repository.name>/pullrequest/<prId>,
  which matches the existing vault values. Never overwrite a pr value
  that is already set.
- Never change status, priority, started, completed, or branch. status
  is vault-owned, per the schema invariant that the vault is the task
  source of truth.
- When the page status and the live state disagree under the map
  below, check the page's existing "## Drift" section first. Append a
  new line, the vault status, the Azure DevOps state, and
  @@RUN_DATE@@, only when the live Azure DevOps state differs from
  the state named in the most recent existing drift line, or when the
  section has no drift line yet. An unchanged, already-recorded drift
  condition gets no new line today. Do not change the frontmatter
  from that comparison.

Expected pairing, for the drift test:

| Vault status | Expected Azure DevOps state |
|---|---|
| todo | New, Ready for Triage, Ready for Fix, Backlog, In Refinement, Ready for Development |
| doing | Ready for Fix, In Development, Blocked, Bug Test Failed |
| review | Ready for Fix, Resolved, Ready for Test, Pending PO Review |
| done | Resolved, Ready for Retest, Closed, In Test, Accepted |
| inbox, dropped | any; never report drift |

Step 11. Update the index.
Add one line under the "## Notes" heading of vault://wiki/index.md for
each of the two note pages, but only when that line is not there yet.
After the first run the index needs no further change, so the two
pages never accumulate index entries.

Step 12. Write the log entry.
Read the last lines of vault://wiki/log.md, then append this entry
after the final entry:

  ## [@@RUN_DATE@@] sync | board scan @@RUN_DATE@@
  - Board: <n> open items across <AREA_PATH_1> and <AREA_PATH_2>; <n> changed since <previous date>.
  - Mine: <n> open items, <n> open pull requests, <n> ready to close.
  - Updated: [[notes/board-state]], [[notes/morning-brief]],
    <task pages touched>.
  - Deferred: <one line per gated action, or "none">.

The text "board scan @@RUN_DATE@@" in the header is the guard that
step 1 reads. Keep it exact.

You may write these paths and no others:
  vault://wiki/notes/board-state.md      (overwrite; this job owns it)
  vault://wiki/notes/morning-brief.md    (overwrite; this job owns it)
  vault://wiki/tasks/<page that already exists>.md  (mirror fields and ## Drift only)
  vault://wiki/index.md                       (append a missing line only)
  vault://wiki/log.md                         (append one entry)
Every other write is forbidden. Never do any of these:
- write to Azure DevOps, or move any work item state;
- comment on a work item or a pull request;
- vote on, complete, or abandon a pull request;
- post to Slack, or call conversations_add_message;
- change a task page's status, priority, started, completed, or branch;
- create any page under tasks/, decisions/, orgs/, people/, projects/,
  sources/, or raw/;
- change schema.md, templates/, views/, or any other note body.
When a step calls for one of these actions, record it as a deferral in
step 9 and step 12 instead. Never do the action.

Stop rules.
Stop, print the reason, and write nothing more when any of these
happen: the Azure DevOps read fails outright; both WIQL queries return
empty; vault://wiki/index.md or vault://wiki/log.md is missing; a step
needs a human decision. A partial run is safer than a wrong write.

Write all vault prose in ASD-STE100 Simplified Technical English.

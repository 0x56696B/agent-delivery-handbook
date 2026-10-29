---
name: tasks-deployed-to-qa
description: Use when the user asks which of their own tasks (bugs, user stories) are actually live on QA right now — covers finding items in the state before the QA state (`Resolved`, `Ready for Test`), extracting each item's fix commit and repo from its linked pull request, proving deployment with a real git ancestry check instead of trusting commit or build dates, and moving a proven item to `Ready for Retest` or `In Test`.
---

## Input

Assignee, defaulting to the current user if the
user doesn't name someone else. Environment, defaulting to QA. Only QA is
implemented: for any other environment, say so and stop.

## Step 1 — Query the board for assigned work items

MCP tool `wit_query`, action `wiql`, project `<ADO_PROJECT>`:

    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State]
    FROM WorkItems
    WHERE [System.TeamProject] = '<ADO_PROJECT>'
      AND [System.AssignedTo] = @Me
      AND [System.State] NOT IN ('Removed', 'Cancelled', 'Duplicate', 'Deffered')
    ORDER BY [System.ChangedDate] DESC

When the user names another assignee, replace `@Me` with that person's email.

Then `wit_work_item`, action `get_batch`, with `project` set, to pull
`System.WorkItemType` and `System.State` for every returned ID. `get_batch`
does not support `expand`; relations come later, per item.

## Step 2 — Pick the items the check gates

Different work item types use different words for the same idea. Confirm the
real list for this project with `wit_work_item`, action `get_type`,
`project` set, per type — never assume a generic template.

This check is the gate that moves an item out of the "fixed, not yet on QA"
state. It runs on the state before the QA state:

- Bug: **Resolved**. On success it moves to **Ready for Retest**. An item
  already in `Ready for Retest` is past this gate; list it as already moved.
- User Story: **Ready for Test** (PR merged, before deploy, per
  `story-workflow` Step 8). On success it moves to **In Test**. A story whose
  own scope is production provisioning or Terraform work does not deploy
  anything to QA; flag it as not applicable rather than checking it.
- Feature: no equivalent state in this project's workflow. Skip Features.

Filter the batch from Step 1 down to items in one of these states.

## Step 3 — Find each item's fix commit and repo

For every qualifying item, `wit_work_item`, action `get`, `expand: "Relations"`
(one call per item; `get_batch` cannot expand relations). Read the
`relations` array for `rel: "ArtifactLink"` entries:

- `name: "Pull Request"` — the PR that carries the fix.
- `name: "Fixed in Commit"` — the exact commit SHA, and the repo ID embedded
  in the `vstfs:///Git/Commit/<projectId>%2f<repoId>%2f<sha>` URL.

An item can carry commits in more than one repo (e.g. a bug fixed in both
`orchestrator` and `web-app`). Record every
repo+commit pair, not just the first one found.

## Step 4 — Get the current QA-deployed commit per repo

Follow `deployed-version-check` for this step: find the real
(tag- or branch-gated) deploy pipeline per repo, not the decoy one, and read
its latest successful build's `sourceVersion` for the currently deployed
commit SHA.

## Step 5 — Prove deployment with a real ancestry check, not dates

<critical>
Never conclude a fix is deployed from commit or build timestamps. A commit
dated before a deploy is not proof it is in that deploy's history — it may
sit on a branch that was never merged into the one that ships. This is not
theoretical: `web-app` fixes merge to `main`, but its QA pipeline
deploys the separate `qa` branch. A date-only check would have been wrong
for exactly this repo.
</critical>

For each repo touched by a qualifying item:

1. Fetch the local bare clone (`~/work/<PROJECT>/<repo>-bare`) with an explicit
   refspec, since these bare repos have no default fetch refspec configured:

       git -C ~/work/<PROJECT>/<repo>-bare fetch origin \
         "+refs/heads/*:refs/remotes/origin/*" "+refs/tags/*:refs/tags/*" --prune

2. Run the real check:

       git -C ~/work/<PROJECT>/<repo>-bare merge-base --is-ancestor <fix-sha> <deployed-sha>

   Exit code `0` means the fix commit is an ancestor of the deployed commit —
   confirmed deployed. Any non-zero exit means it is not proven deployed;
   report it as such, don't round up to "probably fine."

## Step 6 — Report, then write the next state

One row per item, one sub-row per repo it touches:

    <item-id> <title> — <state>
      <repo>: fix <sha-short> is-ancestor-of <deployed-sha-short> (v<tag>) → CONFIRMED | NOT CONFIRMED

Call out separately any item whose "ready to test" state doesn't correspond
to a QA deployment at all (e.g. a production-provisioning story) — state
why the check doesn't apply rather than skipping it silently.

Move an item only when every repo row is CONFIRMED: Bug `Resolved` →
`Ready for Retest`, User Story `Ready for Test` → `In Test`. Write it
without a prompt (RULES.md state exceptions), with a `test` on `/rev`, then
re-fetch and confirm `System.State` holds the new value. An item with any
NOT CONFIRMED row keeps its state.

## Boundaries

- Never modify a PR or branch from this skill. The only work item write is
  the state move in Step 6, and only for an item whose fix is CONFIRMED.
- `git fetch` on the shared bare clones is safe and expected; never push,
  never create or delete branches/tags there.
- `legacy-agent` is a standing exclusion (see `ticket-bootstrap` Step 4);
  never add it. `other-api` is out of scope by default — ask first.

---
name: post-merge
description: Use after one of your own PRs merges (from pr-merge "Report" or morning-brief) to check the dev deploy, gather dev evidence, write the tester handoff document and draft the ticket comment; moves no state and reassigns nobody.
---

This skill covers the segment between "merged" and "the tester retests". Run
it once per merged PR. It writes `<task>/docs/HANDOFF.md`, a ticket comment
draft, and a vault line. It moves no ADO state: `Resolved` / `Ready for Test`
were written at merge, and `Ready for Retest` / `In Test` follow
`tasks-deployed-to-qa`. It never writes `System.AssignedTo`.

## Step 1 — Dev deploy green

Find the deploy definition for each merged repo:

- orchestrator: def `<PIPELINE_ID>` `orchestrator-deploy`
  (`azure-pipelines.yml`).
- web-app: def `<PIPELINE_ID>` `web-app-dev`
  (`azure-pipelines-dev.yml`).
- media-mcp: def `<PIPELINE_ID>` `media-mcp-deploy`.
- data-mcp: def `<PIPELINE_ID>` `data-mcp`.
- file-gateway: def `<PIPELINE_ID>` `file-gateway`.

Call `pipelines_build` action `list` with `project: "<ADO_PROJECT>"`,
`definitions: [<id>]`, `branchName: refs/heads/main`, `top: 1`. Confirm the
build's source version is at or after the squash commit
(`lastMergeCommit.commitId` from the PR) and that `result` is `succeeded`.

- Still running: re-read every 60 s, up to 20 times.
- Failed: stop. Report the build id and the failing log
  (`pipelines_build_log`). Write no handoff.

## Step 2 — Dev evidence

Pick the path that matches the change.

**Web app change.** The dev web app is
`<DEV_URL>`. It is reachable from the
virtual desktop (AVD) only (private endpoint).

- From a host without access: record `dev: not reachable from this host`.
  Use the local `flow-runner` `expect: fixed` run (`docs/flow.yaml`,
  screenshots in its run folder) as the evidence.
- From the AVD: run the flow with `env: dev`.

**API or answer change.** Run def `<E2E_PIPELINE_ID>`
(`orchestrator-api-e2e-regression`) with `pipelines_write`
action `run_pipeline`, `pipelineId: <E2E_PIPELINE_ID>`,
`templateParameters: {"environment": "DEV", "catalogueScope": "regression"}`.
It runs on ADO agents that reach dev, so you do not need the AVD. It takes
about 20 minutes.

1. Poll `pipelines_run` action `get`.
2. Read results with `testplan_show_test_results_from_build_id`.
3. Confirm the new catalogue case (by id) passed.
4. The new case failed: stop and report. An unrelated case failed: report it
   as a side finding.

## Step 3 — Tester handoff document

Write `<task>/docs/HANDOFF.md`:

```
# Handoff: <ticket id> <title>
## What changed
<one or two sentences, user terms>
## Where to test
<env>: <url>. Account: <role>. Build: <deploy build id or QA tag>.
## Steps
1. <click or request>  -> expected: <what the tester sees>
...
## Evidence
Before: <image path or "No visual change.">  After: <image path>
Dev: <e2e pipeline run url, or "not reachable from this host; local run <path>">
## Tick list
- [ ] <three things the tester can confirm>
```

Source the steps from `plan/repro.md` (the reproduction) and the fix plan.
Name the tester for the mention only: the bug's `System.CreatedBy`, or the
last person who moved it to `Bug Test Failed` (from `list_revisions`).
Otherwise ask once. Do not reassign.

## Step 4 — Ticket comment draft

Show the draft in a fenced block. Post only after approval (RULES.md), with
`wit_work_item_comment_write` and `project: "<ADO_PROJECT>"`:

```
@<tester> <what now happens, one sentence>. On <env>: <click path in one line>. Steps and evidence: <HANDOFF.md content pasted, or the key steps>.
```

Attach the after image where the comment supports it. Re-fetch the comments
to confirm the post.

## Step 5 — Vault

Read `vault://wiki/schema.md` first. Find the task page with
`vault://wiki/?op=search&q=<ticket id>`. Append under `## Post-merge`:

```
- <date> · deploy <build id> <result> · dev: <evidence> · handoff docs/HANDOFF.md · comment <id or "not posted">
```

No page found: say so.

## Boundaries

- Own PRs only.
- No state writes.
- No `System.AssignedTo` write.
- No Slack.
- No git in `-bare` paths.
- Never run the e2e regression pipeline before the dev deploy of the merge is green.

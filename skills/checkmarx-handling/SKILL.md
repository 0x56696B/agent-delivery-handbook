---
name: checkmarx-handling
description: Use when handling a Checkmarx One (CxOne) scan report for a platform repo — covers finding the build that ran the scan, downloading the report artifact (the MCP artifact download is broken for this artifact type; use the az CLI fallback), reading the per-engine counts out of the build log, triaging each finding against the real worktree with file:line evidence, drafting one Bug per real finding, and recording the scan as a vault note. Every report file stays inside a task folder; nothing lands at the tasks root.
---

## Input

- A repo name (e.g. `file-gateway`), or a build number, or a ticket
  number whose work is a scan review. Any one of the three is enough.

## Step 1 — Get a task folder first

Never download a report into `~/work/<PROJECT>/tasks` itself. Seven stray
`checkmarx-*` directories at the tasks root are what happens otherwise.

- The scan work belongs to an existing ticket → use that ticket's folder.
- No ticket → run `ticket-bootstrap`'s ticketless variant:
  `RESEARCH-00000-checkmarx-<repo>`, branch `research/checkmarx-<repo>`.

Every artifact, extracted PDF, and scratch note for this scan goes under that
folder, per the `task-files-in-ticket-folder` rule. Put downloads in
`<task-folder>/checkmarx/`.

## Step 2 — Find the build that ran the scan

The scan is a stage inside a normal build-and-deploy pipeline, not a standalone
scan pipeline. Every repo uses the same `/.ado/stage-cxone-scan.yml` template
with the `Checkmarx AST@3` task, `scanType: full`, and `continueOnError: true`,
so a scan failure never fails the build.

Known pipeline definitions that carry the CxOne stage:

| repo | pipeline id | pipeline file |
| --- | --- | --- |
| `file-gateway` | `<PIPELINE_ID>` | `azure-pipelines.yml` (scan is the first stage) |
| `media-mcp` | `<PIPELINE_ID>` | `azure-pipelines.yml` (scan appended after deploy) |
| `web-app` | `<PIPELINE_ID>` | `azure-pipelines-dev-web.yml` |

For any other repo, list definitions with `pipelines_definition` action `list`
and `repositoryId: <repo>`, then read the root pipeline YAML with `repo_file`
to confirm which one includes the CxOne template.

Then find the most recent build on `main` with `pipelines_build` action `list`,
and confirm the scan actually ran: `pipelines_artifact` action `list` for that
build must show an artifact named `Checkmarxone-CxOneScan-Report`. No artifact
means the stage was skipped, not that the repo is clean. `media-mcp`
has a known ordering gap: its scan stage has no `dependsOn: []`, so a failed
deploy stage silently skips the scan.

## Step 3 — Read the counts from the build log

Do this before downloading anything. The Checkmarx AST task log holds the
per-engine severity table, the scan id, and the portal link. Use
`pipelines_build_log` action `list` to find the task's log id, then action
`get_content`.

Capture: scan id, overall risk level, the per-engine Critical/High/Medium/Low/
Info table, and the portal URL
(`https://eu.ast.checkmarx.net/projects/<projectId>/scans?id=<scanId>&branch=main`).

Read the counts by engine, not just the total. Container-engine criticals are
base-image findings, not application code, and they triage differently from a
SAST or IaC finding.

## Step 4 — Download the report artifact

**The MCP `pipelines_artifact` download action is broken for this artifact
type.** It reports success and writes a 0-byte file, confirmed on two
different builds, both to a destination path and as base64. Do not spend a turn
retrying it.

Use the az CLI instead. This is a sanctioned exception under the
`azure-cli-fallback` rule: the MCP tool exists but its download is faulty, so
retry once through MCP at most, then fall back.

    cd <task-folder>
    az pipelines runs artifact download \
      --organization https://dev.azure.com/<ADO_ORG> \
      --project "<ADO_PROJECT>" \
      --run-id <buildId> \
      --artifact-name "Checkmarxone-CxOneScan-Report" \
      --path checkmarx/

If the command rejects a flag, run `az pipelines runs artifact download --help`
and use the flags it lists; do not switch back to the MCP download. If it fails
on auth, run the login command from the `azure-cli-fallback` rule first.

Check the result is real: `cx_result.pdf` should be several hundred KB (about
800,000 bytes for a file-gateway build). A 0-byte or ~16 KB file means the download
failed; do not read it and do not create a second attempt folder beside it.
Overwrite in place.

Read the PDF with the `read` tool. It carries the per-finding detail the log
does not: query name, file path, line numbers, category, and first/last found
dates.

## Step 5 — Triage every finding

Work from the PDF, one finding at a time. For each, open the named file in the
task folder's own worktree and read the cited lines. Classify:

- **Real** — the cited code or config matches the finding today.
- **False positive** — the cited pattern is not present, or the sink is already
  sanitized. Say which line proves it.
- **Duplicate** — the same query already has a Bug or a shipped fix in another
  repo, or in this one. Name the ticket.

Never classify from the finding title alone. Record `file:line` evidence from
the worktree for every classification, including false positives.

Cross-repo duplicates are common: the same template produces the same query in
every repo. `Missing User Instruction` (no `USER` in the Dockerfile) hit both
`media-mcp` and `file-gateway` from one scan round.

## Step 6 — Draft a Bug per real finding

One Bug per real finding, not one per scan. Ask the user before creating any
work item; ADO writes are gated.

- Shape per `pr-and-team-comms`, section "Filing a new bug from a
  finding" (title says what the user gets, repro, how QA checks it, three
  tick-off items, screenshots). Body text in plain first-person voice, per
  `ado-ticket-voice`.
- `System.AreaPath` per `rules/ado-area-path.md` (read the rule; do not
  hardcode the path here).
- Title names the finding and the repo, e.g.
  `Dockerfile runs as root — missing USER instruction (file-gateway)`.
- Body carries: the query name and engine, the file and line, the scan id and
  build number, and the portal link.
- Create with `wit_work_item_write` action `create`, then re-fetch with
  `wit_work_item` action `get` to confirm the fields stuck.

Container-engine base-image findings usually do not get one Bug each. Raise one
Bug for the base-image upgrade and list the findings it clears.

## Step 7 — Record the scan as a vault note

One note per scan, in `vault://wiki/notes/`, named
`<date>-<repo>-checkmarx-scan-report-build-<buildId>.md`. Follow the existing
pattern in `vault://wiki/notes/2026-09-10-file-gateway-checkmarx-scan-report-build-12345.md`:
overview, scan summary with the engine table, per-finding detail, and the
tickets filed.

## Step 8 — Leave nothing at the root

Before you finish, confirm the tasks root gained no new directory:

    cd ~/work/<PROJECT>/tasks && ls -d checkmarx-* 2>/dev/null

Any new entry is a bug in how you ran this skill. Move it into the task folder.
The pre-existing strays from earlier scans belong to a separate cleanup task, not to this one.

## Known repo state, as of 2026-09-11

- A tracking User Story (`#12345`) covers the CxOne rollout across every platform repo and lists
  which repos have the stage and which do not. Check it before filing anything
  about missing coverage.
- `file-gateway` build 12345: 9 critical, 34 high, mostly Containers.
  SAST findings were 5 Low `Log_Forging` in `/src/main.py`.
- The shared template never runs the SCS engine; it lacks the
  `--scs-repo-url`/`--scs-repo-token` flags.
- The task generates a browsable `cxASTResults.html` locally but no pipeline
  step publishes it. Only the PDF is published.

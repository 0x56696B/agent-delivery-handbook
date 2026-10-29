---
name: flow-schema
description: Use when a platform bug needs a Playwright flow (docs/flow.yaml) that a flow-runner agent can follow to reproduce the bug, verify the fix locally, or retest on QA. Covers gathering the ticket, vault, UI map, and source facts, writing the flow per the vault general schema, running the mandatory reproduce pass, and reading the verdict. Mainly for visual bugs in web-app.
---

The general contract is `vault://wiki/notes/flow-schema.md`. Read it
first, every time. This skill writes the per-bug file and drives the
`flow-runner` agent. It never writes ADO, Slack, or vault pages by itself;
those stay behind the gates in `bug-workflow`.

Prerequisite: the task folder exists (`ticket-bootstrap` ran) and the
`web-app` worktree is symlinked into it.

## Step 1: Gather inputs

Read all of these. Do not skip one because another looks complete.

1. The ADO work item: title, description, repro steps, acceptance
   criteria, comments. Fetch every image attachment with
   `wit_work_item_attachment` and look at it. Screenshots anchor the
   `broken` sentence.
2. The vault task page `vault://wiki/tasks/bug-<id>-*.md` and any linked
   decision page.
3. `vault://wiki/notes/ui-map.md`. Note its `sha` field.
4. `web-app` source in the task worktree, for every page and component
   the flow touches. Source wins over the map. Take labels from
   `aria-label`, visible text, and role. When the map's `sha` is older than
   the worktree tip, re-check every label you take from the map.

Out of scope, stop and say so: a bug whose only symptom is the content of a
chat response; a bug with no UI surface; a bug outside `web-app`
unless it shows in the assistant's UI.

## Step 2: Write `docs/flow.yaml`

Path: `<task folder>/docs/flow.yaml`. Create `docs/` when missing.
A returned bug, round `n`, writes a new `docs/flow-r<n>.yaml` and never edits
the earlier flow. The earlier file keeps its `validated` block as proof of
the first fix.

Rules, from the schema page:
- Routes only, never a host.
- `viewport` only when the ticket names a device or size.
- Targets are `role` plus `name`, or `text`. No refs, no CSS.
- Every step has one action. `observe` only where the broken and fixed
  builds look different. Mark those steps `discriminating: true`.
- `observe` sentences name structure, one fact each. Prefer `check: text`
  or `count` when the accessibility tree can show the difference. Use
  `check: screenshot` for layout, overlap, icon presence, alignment.
- A chat prompt step gets `nondeterministic: true`.
- No `validated` block. The runner writes it.

Read the file back once. Check every `name` against the source you read.

## Step 3: Run 1, reproduce on `main`

Run 1 is the validation pass. Skip it never.

1. Check out or confirm a `web-app` worktree at the pre-fix commit.
   Inside the task folder this is usually `main` before the fix branch
   diverged, or the parent of the fix commit. State the SHA.
2. Start the dev server with `services` (`action: start`,
   `services: ["web-app"]`,
   `repo_paths: {"web-app": "<pre-fix worktree>"}`,
   `ports: {"web-app": 5173}`; add `orchestrator` when the flow needs the
   backend). Take `base_url` from the result `url`. Then prove the served build yourself, before
   dispatch: `lsof -nP -iTCP:<port> -sTCP:LISTEN`, then
   `lsof -a -p <pid> -d cwd` must show the pre-fix worktree, and a `curl -sk`
   of one changed source module must lack the fix. A start once reported the
   requested cwd while the process ran in the sibling worktree. Use port
   5173; auto-login works only there.
3. Dispatch `flow-runner` with `flow_path`, `env: local`,
   `expect: broken`, `base_url`, `sha`, `served_sha_verified: true`.
4. The runner logs in by itself on env local. It never reports AUTH HANDOFF
   there. An inconclusive verdict with reason `auto-login failed: ...` means
   the login broke; report it to the user and stop.
5. Read `result.yaml` yourself. Do not trust the runner's summary alone.
   Open one discriminating screenshot and check the citation against it.

Outcome:
- `pass`: the flow is validated. The runner wrote `validated` into the
  flow. Continue.
- `fail`: the flow saw the fixed side on the broken build. The
  `observe` sentences or the target are wrong, or the bug does not
  reproduce. Fix the flow or report to the user. Do not proceed to run 2.
- `inconclusive`: read the failed step. A `target not found` means a stale
  label; fix it from source and rerun.

## Step 4: Run 2 and run 3

Same dispatch with `expect: fixed`. Run 2 uses the fix branch worktree. Run 1
still holds port 5173, so stop the run 1 server and start the fix worktree on
5173 (`services` `action: stop`, then `action: start` with the fix worktree in `repo_paths`). Auto-login fails on any other port. Run 3 uses
`env: qa` and no `base_url`.
On run 3, when the runner reports `AUTH HANDOFF`, tell the user to log in in
the visible browser, then send `continue` to the runner.
Before run 3, confirm the fix commit is deployed with
`deployed-version-check`.

After each run, read `result.yaml`, then write one line under
`## Flow runs` on the vault task page: date, env, expect, verdict, run
folder path. This write is yours, not the runner's.

## Step 5: Tear down

Stop the dev server (`services`, `action: stop`, `services: ["web-app"]`) when you
started it. Confirm the runner closed its tab. Leave nothing running that
was not running before.

## Extend the UI map

When Step 1 read source for a page the map lacks, offer to add that page
to `notes/ui-map.md` with the labels you confirmed and the
worktree SHA. Ask first. Never write the map from memory.

## Playwright MCP traps

- `target` takes only a snapshot ref (for example `e24`) or a CSS selector.
  Get refs with `browser_find`.
- Make one browser call per tool batch. Never batch a browser call with a
  server-side change.
- Tool calls time out at 30 s. Wait with bash `sleep`. After a navigate
  timeout, check `browser_tabs` before a retry.
- Policy denies `browser_evaluate`, `browser_console_messages`, and
  `browser_network_requests`. Read page state with `browser_find`. To log
  requests, add a `configurePreviewServer` middleware in a Vite wrapper
  config in the task folder, and run `vite preview --configLoader runner`.
- The browser runs `--isolated` (see `.omp/mcp.json`), so each session starts
  logged out. Sessions do not share a profile.
- Chromium version mismatch: keep `@playwright/mcp` pinned in
  `.omp/mcp.json` (now `0.0.82`). Do not use `@latest`.
- Before you type, find the focused element with `browser_find` and the
  regex `\[active\]`.
- A tool result that saves console output gives a file path under
  `tasks/.auth/screenshots/`, not under the task folder. Read it there.

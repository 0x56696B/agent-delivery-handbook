---
name: story-refinement
description: Use for Session A of a platform User Story — the interactive refinement session that grills the user, writes the Agent Contract into the ticket description, and moves the story to Ready for Development. Runs BEFORE ticket-bootstrap; creates no branches, no worktrees, no task folder. Hands off to a separate, autonomous story-workflow session.
---

# Session A — Story refinement (interactive)

This is the first half of the two-session story workflow. This session talks
to the user. Its only deliverable is the ticket itself: a complete Agent
Contract in the description, and the state moved to `Ready for Development`.
A different, autonomous session later picks the ticket up with
`story-workflow` and trusts ONLY what this session wrote into ADO.
Anything you learn here that does not land in the ticket is lost.

## Input

- `ticket_number` — the only input.

## Step 1 — Fetch the ticket, confirm it is a story in refinement

Fetch the work item (`wit_work_item`). If the MCP call fails, run the Azure
CLI login command from the `azure-cli-fallback` rule, then retry the MCP
call. Never replace the MCP call with `az boards work-item show`.
It must be a `User Story` (or equivalent feature type). Capture: title, full
description AND its format (HTML or Markdown — you need this for Step 4),
acceptance criteria, state, area/iteration, tags, links, comments.

- State `Backlog` → move it to `In Refinement` (write, then re-fetch to
  confirm).
- State already past `Ready for Development` → stop; this ticket is not in
  refinement. Report to the user.

## Step 2 — Ground in code, without creating anything

Read the affected repos through the existing `main` worktrees under
`~/work/<PROJECT>/<repo>-bare/main` (see `repo-onboarding` if one is missing).

Do NOT run `setup-task-branch.sh`. Do NOT create a task folder or branches.
Reasons: grilling may conclude the story should be split, shrunk, or
rejected — branches across every repo at this point are waste; and the script
creates worktrees in every `*-bare` repo, in and out of scope. Bootstrap
belongs to Session B.

## Step 3 — Grill

Load the `grilling` skill and use it against the user. Questions must be
grounded in the real code you read in Step 2, not only in the ticket text —
"the ticket says X, but `<file>:<line>` does Y; which wins?" is the shape to
aim for.

Exit criteria for this step:
- every acceptance criterion restated in testable form,
- every open question resolved or explicitly deferred with a named owner,
- affected repos listed, non-goals listed,
- for each criterion, a named verification (test command or live check).

## Step 4 — Write the Agent Contract into the ticket DESCRIPTION

The contract lives in the **description**, not in comments. Comments are for
progress notes and tagging people (reasons, questions); the description is the
durable handoff artifact a human or agent reads first.

### Template

```markdown
## Agent Contract (Ready for Development)
### Acceptance criteria (restated, testable)
AC-1: ... (phrased so a test or live check can pass or fail it)
### Resolved questions
Q: ... / A: ... (one pair per ambiguity the grill surfaced)
### Affected repos
<repo list> — and explicit non-goals / repos NOT to touch
### Verification plan
per-AC: the test command or live check that proves it
### Deploy-order notes
what the user sees for each merge/deploy order
### Stop conditions
named conditions that force the implementer to Block and comment
```

All six sections are mandatory. No `TBD`, no placeholder text — the
implementer session's gate rejects the ticket mechanically on any gap.

### Write mechanics — do not clobber the human description

1. **Read-modify-write.** Take the description fetched in Step 1, append the
   contract section to it, and write the WHOLE combined text back. A field
   update replaces the entire field; writing only the contract deletes the
   human-authored description.
2. **Match the field's format.** ADO descriptions are HTML unless the project
   enables Markdown for that field. If the fetched description is HTML,
   convert the contract to HTML (`<h2>`, `<h3>`, `<ul>`) before appending —
   fenced Markdown pasted into an HTML field renders as flat literal text.
3. **Use a format-aware write.** `wit_work_item_write` action `update` takes
   no `format`; action `update_batch` does. For a Markdown field, prefer a
   single-item `update_batch` with `path: "/fields/System.Description"` and
   `format: "Markdown"`. For an HTML field, either action works with HTML
   content.
4. **Re-fetch and verify** that (a) the contract section is present and
   renders with structure, and (b) the original human text is intact. Do not
   trust the write call's own success response.

If refinement changed the story's scope or title materially, update those
fields in the same pass — the description carries the post-refinement truth.

## Step 5 — Comments: questions and people only

Post ONE short comment announcing that refinement is complete and the
contract is in the description, tagging whoever must know (e.g. the PO).
Use comments for reasons and questions directed at people — never for the
contract itself, and never for a plan dump.

## Step 6 — Move to Ready for Development

Ask the user first (state transitions toward review/done are gated). Then:
`In Refinement → Ready for Development`. Write, re-fetch, confirm it stuck.

## Step 7 — Vault entry, then end the session

Add a log entry per the wiki schema (`vault://wiki/schema.md`): ticket,
contract written, state moved. Then stop. Implementation is NOT this
session's job — a fresh session runs `story-workflow` against the
ticket number alone.

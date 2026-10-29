---
name: ticket-triage
description: Use when the /triage command starts. Explains a tracker ticket, confirms understanding by teach-back, grills for missing information, then writes a Spec-Driven-Development spec with Main/Delegated tasks, Big/Mid/Small tiers, dependencies and parallel waves into the ticket, and offers a state move. Tracker specifics come from the project's ticket-triage-profile skill.
---

# Ticket triage

The session is expected to run on the Big tier (the `/triage` command states this precondition). This skill reads code and knowledge sources. It writes only to the ticket. It creates no branches, worktrees, or task folders.

## Tiers

Use this table in the Tasks rules of Step 7. Tiers do not depend on the harness. The spec names only the tier.

| Tier | Work it fits | OMP mapping |
|---|---|---|
| Big | open design, unknown root cause, cross-repo contract changes, integration, final verification | main session on the `slow` role (always Main, never delegated) |
| Mid | scoped implementation or tests in 1-3 files with a clear spec | `task` agent (model role `@task`) |
| Small | mechanical work: renames, config value changes, fixture data, log or data collection, docstrings | `sonic` agent (model role `@smol`) |

## Step 0 - Load the profile

Read `skill://ticket-triage-profile`. It must have these sections: `## Pre-flight`, `## Fetch`, `## Code locations`, `## Knowledge sources`, `## Spec targets`, `## Write rules`, `## State moves`, `## Next step`. Follow each section at its step below. A profile rule wins over a generic rule when the two conflict.

If the read fails (no profile in this project), send one message with these questions:
- Which tool or CLI reads and writes tickets?
- Where does the spec go (a comment, or appended to which field)?
- Where does the code live?

Use the answers for this run. Offer no state move. Say that a `ticket-triage-profile` skill in the project's skills directory makes this permanent.

Then run the profile's `## Pre-flight` steps.

## Step 1 - Fetch everything

Run the profile's `## Fetch` calls. Capture:
- the ticket type, title, and state;
- every long text field;
- all comments;
- linked tickets with their titles and states;
- the attachments. Read image attachments.

Record the field format (HTML or Markdown) and the revision token, if the tracker gives them. From the profile's `## Spec targets`, record the target (a comment, or a field to append to) and the spec heading for this ticket type.

Resume rule: the ticket can already hold an earlier spec (the spec heading) or triage notes (`## Triage Notes`). If so, read them. Check which open questions got answers since then. Show an updated picture in Step 3. Never re-ask a resolved question in Step 6.

## Step 2 - Ground in code (parallel, read-only)

From the ticket text and the profile's `## Code locations`, list the candidate repos or directories. Spawn one `scout` task per candidate in a single `task` call. If the profile gives no code locations, use the current working directory. Each scout returns:
- the relevant files with `file:line`, the current behavior, and the entry points;
- redundancy check: whether the requested behavior already exists. Search by domain concept, not only by the words in the ticket. Report where it looked;
- prior rejection check: read `.out-of-scope/*.md` in the repo if the directory exists. Report any file whose concept matches the request. Match by concept, not by keyword.

## Step 2b - Read the knowledge sources (parallel with Step 2)

Read the user's knowledge vault. A bare `vault://` lists the vaults. Use `vault://wiki/` when it exists. Search with `vault://<vault>/?op=search&q=<ticket id>`. Search again with `q=<2-4 title keywords>`. Read the matching pages through `vault://` URIs only. Then read every extra source in the profile's `## Knowledge sources`.

Use the findings in the explanation and in grilling. Cite the page path for each vault fact. Look up facts here before you ask the user. Never write to the vault. If a search returns no match, say so in one line and continue.

## Step 2c - Check the claim (read-only)

Before any explanation, check the main claim of the ticket against the Step 2 code findings.
- For a defect, trace the described steps through the code path.
- For a feature, confirm that the gap is real.

Record one verdict: `confirmed` (with the code path), `contradicted` (with evidence), or `insufficient detail`. Do not run services or tests here. Full reproduction belongs to the implementation workflow.

## Step 3 - Brief description

Send one message of at most 8 bullets:
- what the ticket asks;
- who it affects;
- current behavior and expected behavior;
- the affected code;
- the gaps visible now;
- the Step 2c verdict;
- any redundancy or prior-rejection match.

If the behavior already exists, or a prior rejection matches, ask the user whether to continue before Step 4.

## Step 4 - Walkthrough

Before you start, write a private checklist of 3-7 key points that the user must understand. Split the ticket into 3-6 ordered topics: background, current behavior with code anchors, desired behavior, the affected flow, constraints and risks.

Send one topic per turn. End each turn with: "Clear, or should I go deeper on this?". Then wait. Answer questions before you move on. Use plain chat turns, not the `ask` tool, because `ask` selects an option on timeout.

## Step 5 - Teach-back gate

After the last topic, ask the user to explain the ticket in their own words: what is wrong or needed, why, and where in the system. Compare the answer with the checklist. For each missing or wrong point, re-explain only that point. Then ask for the teach-back again. The gate passes only when the answer covers all points. Then state "Understanding confirmed" and list the points. Never skip this gate.

## Step 6 - Grill

Read `skill://grilling` and follow it: one question per turn, each with a recommended answer. Ground the questions in the Step 2 and Step 2b findings, in this shape: "the ticket says X, but `<file>:<line>` does Y; which wins?". Look up facts with tools. Put only decisions to the user.

Also grill the task breakdown. For each proposed task, settle the tier, the executor, and the dependencies.

Exit criteria, all required:
- every requirement and acceptance criterion is testable;
- every ambiguity is resolved, or deferred with a named owner;
- the affected repos, the repos not touched, and the non-goals are listed;
- every acceptance criterion has a named verification (a test command or a live check);
- deploy-order effects are known;
- stop conditions are listed;
- the task list is agreed (tier, executor, dependencies).

## Step 7 - Draft the spec, or the needs-info notes

The grill can end with open questions that only a named person outside this session can answer. If those questions block a testable spec, do not draft a spec. Draft triage notes with this template. Write them through the comment rules of Step 8.

```markdown
## Triage Notes
> *This was generated by AI during triage.*

**What we have established so far:**
- <point>

**What we still need from @<owner>:**
- <specific, actionable question>
```

Otherwise, draft the spec with the template below, exactly. The first heading comes from the profile's `## Spec targets` (default `## Triage Specification`). Show the full draft in a fenced code block. Iterate one version per turn. Write only after a clear approval such as "approved" or "write it".

Spec writing principles:
- Durable: the ticket can wait for weeks while the code changes. Name types, functions, interfaces, config shapes, and modules. Never write line numbers in the spec. Use a file path only when no stable symbol exists. (Chat turns in Steps 3-6 still use `file:line`.)
- Behavioral, not procedural: state what the system must do, not how to edit the code.
- Testable: each acceptance criterion passes or fails on its own.
- Explicit scope: list what must not change.

```markdown
## <spec heading from the profile>
> *This was generated by AI during triage.*

_Triaged <YYYY-MM-DD> with /triage. The original ticket text is unchanged._

### Summary
<2-4 sentences: the problem or goal, who it affects, the intended end state>

### Current behavior
<what happens now; for a defect, the broken behavior; include the Step 2c verdict>

### Desired behavior
<what happens after the work, including edge cases and error conditions>

### Key interfaces
- `<TypeOrFunction>` - <what changes and why>

### Requirements
FR-1: The system MUST <one testable behavior>.

### Acceptance criteria (restated, testable)
AC-1: Given <state>, when <action>, then <observable result>. (FR-1)

### Resolved questions
Q: <question> / A: <answer>
Deferred: <question> - owner: <name>

### Affected repos
<repo>: <module, type, or function> - <reason>
Not touched: <repos>. Non-goals: <list>.

### Verification plan
AC-1: <exact test command or live check>

### Deploy-order notes
<what users see for each merge/deploy order, or "Single repo. No order constraint.">

### Stop conditions
<named conditions that force the implementer to stop and comment on the ticket>

### Tasks
| ID | Task | Tier | Executor | Depends on | Wave | Done when |
|---|---|---|---|---|---|---|
| T1 | <repo>: <one verifiable change> | Big | Main | - | W1 | <check> |
| T2 | <repo>: <one verifiable change> | Small | Delegated | - | W1 | <check> |
| T3 | <repo>: <one verifiable change> | Mid | Delegated | T1, T2 | W2 | <check> |

### Execution order
W1 (parallel): T1, T2
W2 (after W1): T3
```

Rules for the Tasks section:
1. Each task has one verifiable outcome. It names its repo and the module, type, or function it changes (a file path only when no stable symbol exists; never line numbers).
2. Tier: every task gets exactly one tier from the Tiers table (Big, Mid, Small), chosen by the "Work it fits" column. The spec names only the tier, never a model or agent name.
3. Executor: A Big task is always Main. A Mid or Small task is Delegated when it is self-contained, with explicit inputs, outputs, and a "Done when" check. A Mid or Small task is Main instead when it needs judgment from the ticket context, integrates other tasks, commits, opens a PR, or writes to the tracker or to chat. Delegated tasks therefore always carry Mid or Small.
4. Depends on lists task IDs only, with no cycles.
5. Wave: W1 for a task with no dependencies. Otherwise 1 + the highest wave among its dependencies.
6. Two tasks in the same wave run in parallel only if neither depends on the other and they edit different files. If they edit the same file, add a dependency and move one task to a later wave.
7. Execution order lists every wave with its task IDs. Mark waves with two or more tasks as `(parallel)`.

No subsection may be empty or contain `TBD`.

## Step 8 - Write to the ticket

Follow the profile's `## Write rules` for the exact calls. These generic rules always apply:
- Never remove or reword original ticket text.
- Field target: read the whole field, append the spec at the end, and write the whole field back. Convert the spec to the field's format (HTML or Markdown). If the field already contains the spec heading, replace from that heading to the end of the field. If other content follows that section, stop and ask the user. If the tracker supports a revision check, send it. On a revision conflict, re-fetch, rebuild, and show the user the diff before you retry.
- Comment target (the spec when the profile says comment, and triage notes always): if an earlier comment starts with the same heading (`## Triage Notes` or the spec heading), update that comment. Otherwise add a new one. If the tracker rejects the size, split at `### Tasks` into two comments. Add the suffixes `(1/2)` and `(2/2)` to the heading.
- Re-fetch and verify. The spec must be present. Every original text field must still hold its Step 1 content, apart from the appended section. Do not trust the write response.

## Step 9 - Offer a state move

Skip this step when Step 7 produced triage notes instead of a spec. Otherwise, check the profile's `## State moves` for an offer that fits this type and current state. If one exists, ask in chat. Write only after a yes. Then re-fetch to confirm. If none exists, make no offer.

## Step 10 - Report

Give the ticket link, where the spec went, the state before and after, and the profile's `## Next step`.

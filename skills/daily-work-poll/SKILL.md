---
name: daily-work-poll
description: Use when the user asks what work happened on a given day (for example "yesterday") on the platform. Polls Azure DevOps and local task folders for every story, bug, PR review, and commit touched that day, and reports each with its number, title, and a brief description.
---

# Daily work poll

Answer "what did I do on day X" for the platform. A single Azure DevOps
query is not enough. Some work leaves no ADO trace on that day (a PR review
saved only as local files). Check three independent sources and merge them.

## Step 1: pin the date range

Take the target day (for example "yesterday") as a local calendar day.
Compute two ranges:

- **UTC range** for the ADO query: local day 00:00 to next day 00:00,
  converted to UTC. Azure DevOps `System.ChangedDate` is UTC.
- **Local range** for file timestamps: local day 00:00 to next day 00:00, in
  the machine's local timezone. Use `date -r <file> '+%F %T %z'` per file
  for a portable local mtime with offset; it works on both GNU and BSD
  `date`, unlike `stat`, whose flags differ between the two.

A day boundary in one timezone can land work in the adjacent UTC or local
day. Check the actual offset before trusting a date match.

## Step 2: query Azure DevOps work items changed by the user

A `ChangedDate` filter alone returns every item anyone touched project-wide,
which is too broad and mostly noise. Filter by `ChangedBy = @Me` as well:

```
Select [System.Id],[System.Title],[System.WorkItemType],[System.State],
       [System.ChangedDate]
From WorkItems
Where [System.TeamProject] = '<ADO_PROJECT>'
  And [System.ChangedDate] >= '<range-start-utc>'
  And [System.ChangedDate] <  '<range-end-utc>'
  And [System.ChangedBy] = @Me
Order By [System.ChangedDate] Desc
```

Run through `wit_query` with `action: "wiql"`. For
each returned ID, fetch full details with `wit_work_item`
(`action: "get"`, one `id` per call — it rejects an `ids` array). Pull
`System.Title`, `System.WorkItemType`, `System.State`, and enough of
`System.Description`/`System.History` to summarize what changed.

This step covers bugs and stories you created, edited, or moved state on.
It does **not** cover PR reviews saved only as local files — those never
touch a work item's `ChangedBy`/`ChangedDate` fields on the review day
itself. Do not treat an empty or short WIQL result as the whole answer.

## Step 3: scan local task folders for PR review artifacts

From `~/work/<PROJECT>/tasks`, list `PR-*` and `PR-REVIEW-*` folders and check
file mtimes inside each `review/` subfolder (or the folder root for older
layouts) against the local range from Step 1:

```
for f in PR*/review/* PR*/*.md; do [ -f "$f" ] && date -r "$f" '+%F %T %z' | xargs -I{} echo "{} $f"; done 2>/dev/null
```

A folder whose `REVIEW.md`, `SECURITY-REVIEW.md`, `QUALITY-REVIEW.md`, or
`diff.patch` timestamp falls inside the target day was worked that day,
regardless of the PR's own creation date or its ADO work item's
`ChangedDate`. Read the folder's `REVIEW.md` for the PR number, repo,
source/target branch, linked work item, and the recommended action
(approve / request changes), and summarize the key findings.

Do not rely on folder name alone to date the work; only the file mtimes
inside prove when the review ran.

## Step 4: scan git history in every bare repo

```
for d in ~/work/<PROJECT>/*-bare; do
  git -C "$d" log --all --since="<local-day-start>" --until="<local-day-end>" \
    --pretty=format:'%h %ad %an %s' --date=iso
done
```

Use `--all` (not just the default branch) since task branches are worktrees
off bare repos and commits land on feature branches, not `main`. Match each
commit's `BUG-NNNNNN`/`#NNNNN` reference back to the ADO item found in Step 2
so the same piece of work is reported once, not twice.

## Step 5: merge and report

For each distinct item found across Steps 2-4, report:

- **Number** (ADO work item ID, or PR number).
- **Title** (work item title, or PR title from its `REVIEW.md`/`PR-CONTEXT.md`).
- **Type** (Bug, User Story, PR review, or commit-only change).
- **Brief description** of what was done: state moved, fix committed, review
  verdict, findings called out.

State plainly if a source (ADO query, task-folder scan, git log) returned
nothing, rather than omitting that source's coverage silently. A short
report from one source is not proof the other sources are also empty; check
all three before concluding the day was quiet.

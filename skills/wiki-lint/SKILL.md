---
name: wiki-lint
description: Use when the user asks for a wiki health check, a lint pass, or a maintenance sweep, or asks about orphan pages, broken links, or stale tasks.
---

## When
- The user asks to lint, health-check, or clean up the wiki.
- The user asks about orphan pages, broken links, or stale tasks.
- The user asks for a periodic maintenance pass.

## Inputs
- The full vault at `vault://wiki/`.
- Vault ops: `vault://wiki/?op=orphans`, `vault://wiki/?op=unresolved`, `vault://wiki/?op=search&q=...`.
- File op per page: `?op=properties` (frontmatter for the schema drift check).
- Exclude `vault://wiki/templates/` and `vault://wiki/raw/` from every check below. Template placeholders and raw originals are not vault pages.
- The contract at `vault://wiki/schema.md`.

## Steps
1. Find orphan pages. Query `vault://wiki/?op=orphans` and list every page with no inbound link. Skip `templates/` and `raw/`.
2. Find unresolved links. Query `vault://wiki/?op=unresolved` and list every broken wikilink. Skip `templates/` and `raw/`.
3. Check schema drift. Read each page's frontmatter with `?op=properties` and compare its keys and values against the field table for its `type` in `vault://wiki/schema.md`. Flag a page that misses a required field or uses a value outside the allowed set. Skip `templates/` and `raw/`.
4. Find stale tasks. List tasks under `vault://wiki/tasks/` with `status: doing` and a `started` date more than 5 working days old. Count weekdays only; skip weekends.
5. Find contradictions. Read pages that link to the same project or topic. Flag pairs that state conflicting facts. Flag any two decision pages on the same scope when neither page has `status: superseded`.
6. Check index coverage. Compare `vault://wiki/index.md` against every page under `vault/orgs/`, `vault/projects/`, `vault/tasks/`, `vault/meetings/`, `vault/people/`, `vault/decisions/`, `vault/notes/`, and `vault/sources/`. Flag a page absent from the index.
7. Write the report. Create `vault://wiki/notes/YYYY-MM-DD-lint-report.md` with `type: note`. Group findings under headings for orphans, unresolved links, schema drift, stale tasks, contradictions, and index gaps. Give each finding a wikilink to the affected page.
8. Add an entry for the new report to `vault://wiki/index.md`, under the Notes heading.
9. Append the log entry (see `## Log`) to `vault://wiki/log.md`.

## Writes
| Page/file | Fields changed |
|---|---|
| `vault://wiki/notes/YYYY-MM-DD-lint-report.md` | new page: `type: note`, `projects`, `topics`, `updated`, body findings |
| `vault://wiki/index.md` | new entry for the lint report, under the Notes heading |
| `vault://wiki/log.md` | appended entry |

## Log
```
## [YYYY-MM-DD] lint | Lint report
- Found <n> orphan(s), <n> unresolved link(s), <n> schema drift page(s), <n> stale task(s).
- Report: [[notes/YYYY-MM-DD-lint-report]].
```

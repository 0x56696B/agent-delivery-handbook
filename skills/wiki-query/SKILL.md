---
name: wiki-query
description: Use when the user asks a question the wiki can answer, about the client, the consultancy, a project, a task, a person, or a past event. Reads the index first, cites pages, and files durable answers as notes.
---

## When
Trigger on a question about a project, a task, a person, an org, or a past event.
Trigger when the user asks to look something up in the wiki.

## Inputs
- The user's question.
- Optional hints: a project name, a person name, a date range, or a topic.

## Steps
1. Read `vault://wiki/index.md` first. Find candidate pages by topic and type.
2. Search the vault for extra matches: `vault://wiki/?op=search&q=<terms>`.
3. Read each candidate page in full before you use it.
4. Check `vault://wiki/<page>?op=backlinks` and `?op=links` on key pages for related pages.
5. Follow wikilinks into related pages until you can answer the question.
6. Build the answer from page content only. Never state a fact without a source page.
7. Cite each claim with a wikilink to its source page.
8. Judge whether the answer is durable: a reusable synthesis, not a one-off fact.
9. If the answer is not durable, give the answer and stop.
10. If the answer is durable, create or update a note page at `vault://wiki/notes/<slug>.md` from `vault://wiki/templates/note.md`.
11. See `vault://wiki/schema.md` for the note field table.
12. Set `projects` and `topics` to match the question. Set `updated` to today's date.
13. Write the answer in the body, with a wikilink for each cited page.
14. Add or update the note entry in `vault://wiki/index.md`, under the Notes heading.
15. Append a log entry to `vault://wiki/log.md`.

## Writes
| Page or file | Fields or content changed |
|---|---|
| `vault://wiki/notes/<slug>.md` (only for a durable answer) | `type`, `projects`, `topics`, `updated`, `created`, body with citations |
| `vault://wiki/index.md` (only for a durable answer) | new or updated entry under the Notes heading |
| `vault://wiki/log.md` (only for a durable answer) | one new entry appended |

## Log
Append this entry to `vault://wiki/log.md`, only when you file a note:
```
## [YYYY-MM-DD] query | <question or note title>
- Answered: <question, in a few words>. Cited: <source pages>.
- Filed note: <note page>.
```

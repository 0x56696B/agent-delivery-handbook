---
name: wiki-ingest
description: Use when the user gives a source to file into the wiki — a file already in vault/raw/, or pasted text to save there first. Files the source, updates related pages, the index, and the log.
---

## When
Trigger on a new source: a clipping, a document, a link, or pasted text.
Trigger when the user names a file already inside `vault://wiki/raw/`.
Trigger when the user pastes text and asks you to file it.

## Inputs
- A raw file path inside `vault://wiki/raw/`, or pasted text.
- The source origin: url, meeting, slack, file, or chat.
- Optional hints: related projects, a topic, a title.

## Steps
1. Identify the entry point: a named raw file, or pasted text.
2. If the user pasted text, build a slug from the topic in kebab-case.
3. Write the pasted text to `vault://wiki/raw/YYYY-MM-DD-<slug>.md`. Use today's date.
4. If the user named an existing raw file, read it. Never edit a file in `raw/`.
5. Read the full raw content before you summarize it.
6. Pull out the origin, the url (if any), and each related project.
7. Create a source page at `vault://wiki/sources/YYYY-MM-DD-<slug>.md` from `vault://wiki/templates/source.md`.
8. Fill the frontmatter. See `vault://wiki/schema.md` for the source field table.
9. Set `raw` to a wikilink to the raw file. Set `projects` to a wikilink for each related project.
10. Set `created` to today's date. Write a short summary in the body.
11. Search the vault for pages that need an update: `vault://wiki/?op=search&q=<topic>`.
12. Check `vault://wiki/?op=unresolved` for links that now match the new source page.
13. Update each related project, org, or person page. Add one line and a wikilink to the source page.
14. Add an entry for the source page to `vault://wiki/index.md`, under the Sources heading.
15. Append a log entry to `vault://wiki/log.md`.

## Writes
| Page or file | Fields or content changed |
|---|---|
| `vault://wiki/raw/YYYY-MM-DD-<slug>.md` | created, only for the pasted-text entry point |
| `vault://wiki/sources/YYYY-MM-DD-<slug>.md` | `type`, `date`, `origin`, `url`, `raw`, `projects`, `tags`, `created`, body summary |
| `vault://wiki/projects/<name>.md` (related) | body: one line and a wikilink to the new source |
| `vault://wiki/orgs/<name>.md` or `vault://wiki/people/<name>.md` (related) | body: one line and a wikilink to the new source |
| `vault://wiki/index.md` | new entry under the Sources heading |
| `vault://wiki/log.md` | one new entry appended |

## Log
Append this entry to `vault://wiki/log.md`:
```
## [YYYY-MM-DD] ingest | <source title>
- Filed <source title> from <origin>.
- Updated: <list of changed pages>.
```

---
name: wiki-meeting
description: Use when the user gives a meeting transcript, notes, or a caption or transcript file — a file already in vault/raw/, pasted text, or a `.vtt`/`.srt`/`.docx` download to clean first. Files the meeting, action items as tasks, and attendees as people.
---

## When
Trigger on a meeting transcript, meeting notes, or a standup summary.
Trigger when the user names a meeting file already inside `vault://wiki/raw/`.
Trigger when the user pastes meeting text and asks you to file it.
Trigger when the user names a caption file, such as a `.vtt` or `.srt` transcript download.
Trigger when the user names a Word-doc meeting-recording export (`.docx`).

## Inputs
- A raw file path inside `vault://wiki/raw/`, pasted meeting text, or a caption or transcript file path.
- The meeting date, kind, project, and org, from the user or from the content. Ask the user for any field the content does not state.
- The attendee list, from the content, from caption or transcript speaker labels, or from the user.

## Steps
1. Identify the entry point: a named raw file, pasted text, a caption file (`.vtt`, `.srt`), or a Word-doc meeting-recording export (`.docx`).
2. If the entry point is a caption file, clean it before anything else. Strip cue-number lines and `-->` timestamp lines. Unwrap WebVTT `<v Speaker Name>` tags into `Speaker Name: text` lines. Drop a line that exact-duplicates the line before it, and collapse rolling caption lines where one cue's text is a prefix of the next into the longest version only. Join the result into one plain transcript.
3. If the entry point is a Word-doc meeting-recording export, clean it before anything else. Drop `<!-- image_N -->` marker lines and the "started transcription"/"stopped transcription" marker lines. Each turn starts with a bold `**Speaker Name [Tag]** MM:SS` header line; unwrap it into `Speaker Name: ` followed by every line up to the next header, joined into one paragraph, and drop the bracket tag from the label. If the file opens with a title, a date line, and a duration line before the first turn, read the meeting date and title from there instead of asking.
4. If the caption or transcript file carries no speaker labels anywhere, ask the user for the attendee list before you continue.
5. If the user pasted text, build a slug from the meeting topic in kebab-case.
6. Write the cleaned or pasted text to `vault://wiki/raw/YYYY-MM-DD-<slug>.md`. Use the meeting date.
7. If the user named an existing raw file, read it. Never edit a file in `raw/`.
8. Read the full raw content before you extract facts from it.
9. Pull out the date, the kind, the project, the org, and each attendee.
10. The kind is one of: standup, refinement, planning, one-on-one, adhoc, or retrospective.
11. If the date, the kind, the project, or the org stays unclear after you read the content, ask the user for it. Never guess a project or org link.
12. For each attendee, check for an exact match at `vault://wiki/people/<first-last>.md`.
13. If no exact match exists, list `vault://wiki/people/` and look for a close spelling match. Caption or transcript text often misspells a name, for example "Jhon Doe" for "John Doe", or uses a full first name for someone already filed under a short name, for example "Benjamin Roe" for "Ben Roe".
14. If a close match exists, ask the user to confirm it is the same person before you link it.
15. If no match exists at all, create a new page from `vault://wiki/templates/person.md`. Ask the user to confirm the correct spelling. This includes the vault owner, if they attended; state that plainly in the new page's Overview.
16. Fill the org field on the new person page. A bracket tag next to a name in a Teams export (`[Guest]`, `[Contractor]`, or none) shows that person's guest-or-host status in whichever tenant hosted the call, not their employer. Cross-reference the name against the existing `vault://wiki/people/` roster first; only fall back to the bracket tag, flagged as unconfirmed, when no roster match exists. Fill the role field if you know it.
17. Create a meeting page at `vault://wiki/meetings/YYYY-MM-DD-<slug>.md` from `vault://wiki/templates/meeting.md`.
18. Fill the frontmatter. See `vault://wiki/schema.md` for the meeting field table.
19. Set `attendees` to a wikilink for each person. Set `raw` to a wikilink to the raw file.
20. Set `created` to today's date. Write the summary and the decisions in the body.
21. In the Discussion section, name the attendee who raised each point or made each decision. Link the name to their person page.
22. Pull out each action item from the raw content.
23. Before you create a task page, search `vault://wiki/tasks/` for an existing open task on the same issue, raised in an earlier meeting. If one exists, add a Notes bullet to that task page linking the new meeting instead of creating a duplicate.
24. For each remaining action item, create a task page at `vault://wiki/tasks/<slug>.md` from `vault://wiki/templates/task.md`.
25. See `vault://wiki/schema.md` for the task field table.
26. Set `status` to `inbox` on every new task page. Set `priority` to `p3` unless the text states one.
27. Set `project` to a wikilink to the matching project. A meeting can leave its own `project` null while each task filed under it still gets its own specific project. Add a wikilink to the meeting page in the task body.
28. If the raw content names an owner for the action item, add a wikilink to that person in the task body.
29. Update the linked project page with a wikilink to the new meeting page.
30. Add entries for the meeting page, the new task pages, and the new person pages to `vault://wiki/index.md`. File them under the Meetings, Tasks, and People headings.
31. Append a log entry to `vault://wiki/log.md`.

## Writes
| Page or file | Fields or content changed |
|---|---|
| `vault://wiki/raw/YYYY-MM-DD-<slug>.md` | created, for the pasted-text, caption-file, or Word-doc entry point |
| `vault://wiki/meetings/YYYY-MM-DD-<slug>.md` | `type`, `date`, `kind`, `project`, `org`, `attendees`, `raw`, `created`, body |
| `vault://wiki/tasks/<slug>.md` (one per new action item) | `type`, `project`, `status: inbox`, `priority`, `created`, body with meeting wikilink and owner wikilink |
| `vault://wiki/tasks/<slug>.md` (existing, same issue raised again) | Notes: one bullet linking the new meeting, no duplicate task created |
| `vault://wiki/people/<first-last>.md` (new attendees) | created: `type`, `org`, `role`, `created` |
| `vault://wiki/projects/<name>.md` (linked project) | body: wikilink to the new meeting page |
| `vault://wiki/index.md` | new entries under the Meetings, Tasks, and People headings |
| `vault://wiki/log.md` | one new entry appended |

## Log
Append this entry to `vault://wiki/log.md`:
```
## [YYYY-MM-DD] meeting | <meeting title>
- Filed <meeting title> with <n> attendees and <n> action items.
- New pages: <task pages>, <person pages>.
```

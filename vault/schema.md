# Schema

## Purpose
This page is the contract for the vault. It defines the folders, the fields, and the rules that every page must follow.

## Tree
```
vault/
  schema.md      # the contract: conventions, page types, field tables, log format
  index.md       # catalog of hub pages, grouped by type
  log.md         # append-only event log
  orgs/          # org pages: the client, the employer, Personal
  projects/      # one page per project or repo
  tasks/         # one page per task
  meetings/      # one page per meeting
  people/        # one page per person
  decisions/     # one page per decision
  notes/         # concept pages, syntheses, filed answers
  sources/       # one page per ingested source
  raw/           # immutable original files; never edited
  views/         # Base files for saved queries
  templates/     # one template per page type
```

## Naming rules
- File names use kebab-case, except org file names, which use the org's proper name written without spaces, for example `AcmeGrid.md`.
- Meeting, decision, and source file names start with a `YYYY-MM-DD-` prefix, then a kebab-case slug.
- Person file names use the pattern `first-last.md`.
- Project file names use the repo name in kebab-case.
- Task file names use a kebab-case slug that summarizes the task.
- Note file names use a kebab-case slug. A dated note, such as a lint report, starts with a `YYYY-MM-DD-` prefix.
- A wikilink uses the folder-qualified path without the `.md` extension, for example `[[people/jane-doe]]` or `[[orgs/AcmeGrid]]`. In frontmatter, wrap the wikilink in double quotes.

## Field tables
Every page type has `type` and `created` (`YYYY-MM-DD`). Every page type may add `tags` (list).

### org
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `org` |
| `ado_org` | string or null | any ADO org name, or `null` |
| `slack_channels` | list | Slack channel names |
| `status` | string | `active`, `inactive` |

### project
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `project` |
| `org` | wikilink | link to an org page |
| `repo` | string or null | remote URL, or `null` |
| `repo_path` | string or null | local checkout path, or `null` |
| `ado_project` | string or null | ADO project name, or `null` |
| `ado_repo` | string or null | ADO repository name, or `null` |
| `default_branch` | string | branch name, default `"main"` |
| `ado_states` | map or null | vault status -> ADO state name, or `null` before the first sync |
| `status` | string | `active`, `paused`, `done` |
| `summary` | string | one line |

Create org and project pages on demand.

### task
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `task` |
| `project` | wikilink | link to a project page |
| `status` | string | `inbox`, `todo`, `doing`, `review`, `done`, `dropped` |
| `priority` | string | `p1`, `p2`, `p3` |
| `started` | date or null | `YYYY-MM-DD`, or `null`; set when `status` moves to `doing` |
| `ado_id` | int or null | ADO work item id, or `null` |
| `ado_state` | string or null | ADO state, or `null` |
| `sprint` | string or null | sprint name, or `null` |
| `due` | date or null | `YYYY-MM-DD`, or `null` |
| `completed` | date or null | `YYYY-MM-DD`, or `null` |
| `pr` | string or null | pull request URL, or `null` |
| `branch` | string or null | branch name, or `null` |

### meeting
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `meeting` |
| `date` | date | `YYYY-MM-DD` |
| `kind` | string | `standup`, `refinement`, `planning`, `one-on-one`, `adhoc`, `retrospective` |
| `project` | wikilink or null | link to a project page, or `null` |
| `org` | wikilink | link to an org page |
| `attendees` | list | wikilinks to person pages |
| `raw` | wikilink or null | link to a raw file, or `null` |

### person
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `person` |
| `org` | wikilink | link to an org page |
| `role` | string or null | job title, or `null` |
| `slack_id` | string or null | Slack member id, or `null` |
| `email` | string or null | email address, or `null` |

### decision
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `decision` |
| `date` | date | `YYYY-MM-DD` |
| `project` | wikilink | link to a project page |
| `status` | string | `accepted`, `superseded` |
| `supersedes` | wikilink or null | link to an older decision, or `null` |

### note
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `note` |
| `projects` | list | wikilinks to project pages |
| `topics` | list | topic strings |
| `updated` | date | `YYYY-MM-DD` |

### source
| Field | Type | Allowed values |
|---|---|---|
| `type` | string | `source` |
| `date` | date | `YYYY-MM-DD` |
| `origin` | string | `url`, `meeting`, `slack`, `file`, `chat` |
| `url` | string or null | source URL, or `null` |
| `raw` | wikilink or null | link to a raw file, or `null` |
| `projects` | list | wikilinks to project pages |

## Log entry format
Each entry in `log.md` starts with a header line, then one to three bullet lines.

Header: `## [YYYY-MM-DD] <op> | <title>`

`op` is one of: `ingest`, `meeting`, `task`, `sync`, `lint`, `query`, `comms`, `setup`.

Bullets state what changed and which pages the change touched.

Append rules:
- Read the last lines of `log.md` first. Then append the new entry after the final entry.
- Do not insert at a line number from an old read. A stale window can delete the header of a nearby entry.
- When you edit any vault page, copy the exact `[path#TAG]` header from the last read. A shortened path fails the edit.

## Hard invariants
- `raw/` is immutable. Never edit a file inside `raw/`.
- `log.md` is append-only.
- Ask the user before: pull request creation, ADO state moves to review or done, any Slack post. For a ticketed task inside the platform tasks root, the project rules win: the PR opens with no prompt once its verification gate passes, and tracker moves follow the project's exception list. The Slack rule has one exception: the fixed PR-open line.
- The vault is the task source of truth. Never silently overwrite vault task state from ADO.
- All vault prose follows ASD-STE100.

## View catalog
Six Base files live in `views/`. Each Base is a saved query over page frontmatter.

| File | Shows |
|---|---|
| `tasks.base` | All task pages. Groups by `status`. Sorts by `priority`, then `due`. |
| `meetings.base` | All meeting pages. Sorts by `date`, newest first. Groups by `project`. |
| `decisions.base` | All decision pages. Groups by `project`. Filters by `status`. |
| `people.base` | All person pages. Groups by `org`. Shows `role` and `slack_id`. |
| `projects.base` | All project pages. Groups by `status`. Shows `summary` and `ado_project`. |
| `sources.base` | All source pages. Sorts by `date`, newest first. Groups by `origin`. |

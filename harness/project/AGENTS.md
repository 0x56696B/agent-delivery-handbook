# <PROJECT> — project context

Maintain `~/work/<PROJECT>/tasks/docs/PAPERCUTS.md`, a global log shared by all
sessions of anything that slowed down development. When you lose time to one
mid-session, append date · symptom · fix · project. Check this file first when
tooling fails mysteriously.

## Standing facts

- ADO org `<ADO_ORG>`, project `<ADO_PROJECT>`.
- Repos bare-cloned under `~/work/<PROJECT>/`: `orchestrator`,
  `data-mcp`, `media-mcp`, `file-gateway`,
  `web-app`, `infra`, `legacy-agent`.
- `legacy-agent` is a standing exclusion. It is being retired.
  `setup-task-branch.sh` skips it.
- `infra` is pure Terraform. No local start step, no local
  test step. Branch and PR rules still apply.
- Out of scope unless a ticket names them: `other-api`,
  `other-automation`, `labs`, `other-infra`.
- Team Slack channel `#<team-channel>`, unless the user names another.
  `#<tech-channel>` and `#<all-teams-channel>` exist but carry little.
- Git and PR standards: ADO repo `<STANDARDS_REPO>`,
  `/Git Standards/README.md`. Trunk-based, `main` protected, Conventional
  Commits PR titles, squash merge, 1 Owner approval minimum.
- A User Story runs as two sessions. Session A is `/triage` or
  `story-refinement`: interactive, writes the Agent Contract into the
  ticket. Session B is `story-workflow`: autonomous, picks the ticket
  up by number. Never bootstrap a story before the contract exists. A Bug
  stays single-session. Its reproduction is the contract.

## Who I am

- ADO identity `<YOUR_EMAIL>`, display name
  `<YOUR_DISPLAY_NAME>`. A PR is mine when `createdBy.uniqueName` equals
  this address. Every other PR is someone else's.
- Local web-app Entra login: `<TEST_USER_EMAIL>`. Local
  config uses the consultancy's tenant, so the client's test account cannot sign
  in locally (AADSTS90072). Playwright local login uses the consultancy test user
  and the secrets file named by `--secrets` in `.omp/mcp.json`. Never read
  or print that file.
- Employer `<EMPLOYER>` (the consultancy), client `<CLIENT>`. The product is
  `<PRODUCT>`, the assistant. `web-app` is its UI, `orchestrator` its backend.

## Team

- Roles, history, and who is still on the team: `vault://wiki/people/`.
  Do not keep a roster here; it drifts.
- `<TECH_LEAD>` is the technical lead.
- A teammate's work email is not always spelled like their display name. Look
  the address up with `core_get_identity_ids` before you filter, assign, or
  search by it. Do not derive it from the name.

## Someone else's PR

- Never fetch, edit, push, merge, or abandon another person's branch.
- Act as a reviewer only: read, draft, write a handoff doc. Post nothing
  without approval.
- Never change the status of a thread that another person started.

## Vocabulary

Translate every ADO code before it reaches the user. Never show the number.

| Field | Code | Say |
|---|---|---|
| PR `status` | 1 / 2 / 3 | Active / Abandoned / Merged |
| PR `mergeStatus` | 2 / 3 | conflicts / no conflicts (other values: not set, queued, rejected by policy, merge failed; the integer for each is not confirmed) |
| Thread `status` | 1 / 2 / 3 / 4 / 5 / 6 | Active / Resolved / Won't Fix / Closed / By Design / Pending |
| Thread `commentType` | 3 | system thread, skip it |
| Vote | any | approved, approved with suggestions, waiting for author, rejected |

The API name for thread status 2 is `fixed`. Say "Resolved", the ADO UI
word. Never write a numeric vote ("voted 10", "-5") in replies, reports,
or drafts.

## Work item states

- Bug: `New → Ready for Triage → Ready for Fix → Resolved → Ready for
  Retest → Closed`. Side states `Bug Test Failed`, `Blocked`, `Reopen`.
  Terminal `Cancelled`, `Duplicate`, `Deffered` (ADO spelling). A Bug has no
  `Ready for Test`.
- User Story: `Backlog → In Refinement → Ready for Development →
  In Development → Ready for Test → In Test → Pending PO Review →
  Accepted`. Side states `Blocked`, `Removed`.
- A PR merge never moves the item, even with `transitionWorkItems: true`
  (seen on BUG-12345, PR 4567).
  `Resolved` (Bug) and `Ready for Test` (Story) follow the merge.
  `Ready for Retest` (Bug) and `In Test` (Story) follow the QA deploy
  check in `tasks-deployed-to-qa`. One state per write, then re-fetch.
- A bug whose state went back from `Resolved` or later is a returned bug.
  The tester's reason is in the comments. Never overwrite that state.

## Environments

- Local default ports: orchestrator 8000, media-mcp 8001,
  data-mcp 8002, file-gateway 9000, web-app 5173. The service agent
  files are authoritative.
- QA: `<QA_URL>`, manual login. `/dashboard` and
  `/statistics/batch` need `ROLES.ADMIN_USER`; ask a QA admin for the role
  before dashboard work.
- Dev: web-app `<DEV_URL>`, orchestrator
  `<DEV_API_URL>`. Private endpoint,
  reachable from the virtual desktop only. The test user can log in there. From this
  laptop, dev evidence for API and answer changes comes from pipeline def `<PIPELINE_ID>`
  (`orchestrator-api-e2e-regression`), which runs on ADO agents.
- Tenant and subscription IDs: `vault://wiki/projects/infra.md`.
- Each worktree `.env` is a symlink to the bare repo's root `.env`. One
  edit changes every task's worktree of that repo.
- `CLIENT_AZURE_PAT` holds base64 `user:pat`. Send it as
  `Authorization: Basic $CLIENT_AZURE_PAT`, not with `curl -u`.

## Task folders

- One folder per ticket: `BUG-<n>-<slug>`, `STORY-<n>-<slug>`,
  `PR-REVIEW-<n>`, `RESEARCH-00000-<slug>`. `main` holds worktrees synced
  with `main`. Repo entries are symlinks; use `git -C <folder>/<repo>`.
- Inside: `docs/` for findings and attachments, `plan/` for design docs,
  `review/` for PR review reports. Scratch files stay in the folder.
- The status line hides git on purpose (`git.enabled: false`). Read the
  branch with `git -C`, not from the footer.

# Dictionary

Words are hard. Here is every hard word in the book and the pack. Sorted A to Z. Each has a plain meaning and an example. A word confuses you? Come here first.

The examples use made-up names and numbers. Paths point into the pack. A path in angle brackets is a placeholder you fill.

| Term | Plain meaning | Example |
|---|---|---|
| Acceptance criteria (AC) | Plain tests a story must pass to count as done. Each one can pass or fail. | AC-1: the list shows three items after a refresh. |
| Accepted | The last Story state. The product owner decides it. The agent never writes it. | A story moves to Accepted after the tester and the owner agree. |
| Actionable bug | A board bug with work left for you. "Picked up" means a folder, branch, PR, or live session, not just assignment. | A bug with a task folder and no PR yet. |
| ADO (Azure DevOps) | The tracker, repo host, and pipeline service the author used. | Bugs, Stories, PRs, and builds all live in ADO. |
| ado_states | A project page field: the map from vault status to tracker state. | `doing` maps to Active. |
| Advisor (watchdog) | A second model that reads the agent's work and whispers a warning. Silence means fine. | `WikiScribe` files facts. `PRSecurity` watches a review. |
| advisor-drain | An extension that holds the turn open until every advisor finishes. | It keeps an in-flight vault write from being lost. |
| Agent | The AI that does the work: reads files, calls tools, writes code. | The main agent runs `/bug 12345`. |
| Agent Contract | Six sections written into a Story ticket: acceptance criteria, resolved questions, repos, verification plan, deploy-order notes, stop conditions. Session B trusts only this. | A story with no stop conditions fails the gate. |
| AGENTS.md | The file of standing facts for a project: names, repos, state ladders, vocabulary. | `harness/project/AGENTS.md` |
| Allowlist | A list of things allowed to pass. A scanner allowlist hides known false alarms. | A rule-scoped block in `scripts/gitleaks.toml`. |
| Always-on rule | A rule loaded into the prompt every turn. Its header says `alwaysApply: true`. | `rules/global/read-tool-first.md` |
| Amend | Change the last commit instead of adding a new one. | `git commit --amend` keeps one commit per repo. |
| Ancestry check | A git test: is commit A inside the history of commit B? It proves a fix shipped. Dates cannot. | `git merge-base --is-ancestor <fix> <deployed>` |
| Anchor (review comment) | The file and lines a review comment points at. It must sit on lines the PR changed. | A thread anchored on an untouched file never shows. |
| API | A set of web addresses that programs call to ask for things. | The `orchestrator` is a backend API. |
| Append-only | You may add lines at the end. You may never edit or delete old lines. | `vault/log.md` |
| APPEND_SYSTEM.md | A file that adds your manners to the system prompt: knowledge limits, wiki, writing standard, chat style. | `harness/global/APPEND_SYSTEM.md` |
| Approval gate | A check that stops a tool call until a person says yes, or blocks it. Three layers: prose rule, skill step, harness config. | `tools.approval` in `harness/project/config.yml`. |
| Approval phrase | A clear yes: "send it", "approved", "go". Anything vaguer means ask again. | The agent posts a Slack draft only after "send it". |
| Area path | A tracker field that places an item on a board or team. The board is an area path, not an iteration path. | Query the area path to see one board. |
| ArtifactLink | A work item relation that points to a PR or a commit. | Read it to find the fix commit. |
| ASD-STE100 | Simplified Technical English: a plain writing standard. Short active sentences, one word per meaning. | "Open the file." not "The file should be opened." |
| Assistant (the product) | The client's chat product that the platform builds. Not the coding agent that helps you. | A change to what the assistant says gets a catalogue case. |
| Attach (debugger) | Connect the debugger to a service that already runs. | Attach to the Python service on its debug port. |
| Auditor (`tool-call-auditor`) | A small model that reads one ticket comment or browser snippet and answers SAFE or not. Only SAFE skips the dialog. | It reviews comment text for secrets. |
| AUTH HANDOFF | A `flow-runner` stop: the page needs a human login. Log in, then say `continue`. | QA runs always stop here. |
| Author (the author) | The engineer who built this setup. The only human the agent works for. | The author approves drafts and merges. |
| Auto-complete | A PR setting that merges the PR by itself once every policy passes. Arm it last. | Armed too early, a PR merged unreviewed in about 15 seconds. |
| autoCompleteSetBy | A PR field that shows who armed auto-complete. | Check it before you vote on a colleague's PR. |
| Backfill | Fill in the days a job missed, oldest first. | `slack-ingest` covers Friday to Sunday on Monday. |
| Backlog | The list of work not yet planned into a sprint. | A story in Backlog still needs refinement. |
| Bare repo | A git clone with history and no checked-out files. It stores the worktrees. Agents never touch it directly. | `web-app-bare/` |
| .base file | An Obsidian saved table over the header fields of vault pages. | `vault/views/tasks.base` shows the task board. |
| Base64 | A way to write bytes as plain text. | The PAT variable holds `user:pat` in base64. |
| Baseline | A run on `main` before the fix, to prove the problem exists. | Gate: at least 1 of 15 baseline runs must show the bug. |
| Blocked | A state that says: stopped, waiting on a person. | A story moves to Blocked when the code contradicts the contract. |
| Blocker (severity) | The top advisor level: fix this now. | A fails-open guard about to be reported clean. |
| blocks (Slack) | A structured Slack message format. Links render only through its rich-text elements. | The PR-open line uses a `blocks` payload. |
| Board | The tracker view of work items in columns. The area path picks the board. | The team board. |
| Bootstrap | Make a ticket's folder, branches, and worktrees with the script, then set the first state. | `ticket-bootstrap` |
| Branch | A named line of commits. One ticket, one branch. | `fix/prompt-search-mismatch` |
| Branch policy | Tracker rules that guard `main`: required reviewers, builds, a linked work item. The real gate. | An unlinked PR can be blocked. |
| Breakpoint | A line where the program pauses so you can look inside. | Set one on the suspect path, then re-fire the request. |
| Brief (morning brief) | A vault page the morning job writes: what to close, what needs a QA check, what needs you. | `/morning` works it. |
| Broker (harness) | A harness process that supervises background processes. The sources use the word without more detail. | "A detached mode survives the broker." [INFERENCE] |
| Bug | A work item for broken behaviour. | Bug 12345. |
| Bug states | The ladder: New, Ready for Triage, Ready for Fix, Resolved, Ready for Retest, Closed. Side states: Bug Test Failed, Blocked, Reopen. Ends: Cancelled, Duplicate, Deffered (the tracker's spelling). | The agent writes up to Ready for Retest. The tester writes Closed. |
| BUG_FIXING (rule) | The global rule for bug work: reproduce at the real boundary, verify live, re-check every helper claim. | `rules/global/BUG_FIXING.md` |
| Bun | A fast JavaScript runtime. The pack uses it to build the PDF. | `bun build.ts`, run inside `build/`. |
| bypassPolicy | A PR option that skips branch policy. Never set it. | `bypassPolicy: false` in the merge call. |
| Caption file (.vtt, .srt) | A subtitle text file of a recorded call: cue numbers, timestamps, spoken lines. | `wiki-meeting` cleans it before filing. |
| Catalogue (prompt-regression catalogue) | A JSON list of prompts with the behaviour the assistant must show. Each case has an id, a prompt, guards, and `expect` rules. It runs nightly on dev. | Add a case when an answer broke. `expect` keys: `tools_none`, `max_seconds`. |
| Checkmarx (CxOne) | A static scan product. It finds risky code patterns without running the code. | A scan report gives counts per engine. |
| Chromium | The open-source browser that Playwright drives. | Pin the Playwright MCP, or Chromium moves under you. |
| CI | Continuous integration: a server builds and tests every push. | The PR pipeline runs lint, typecheck, and tests. |
| `/clear` (clear context) | Wipe the chat memory of one session. Files and vault stay. | The agent calls `clear_context` when you ask in plain words. |
| CLI | Command-line interface: a program you run by typing. | `az` is the cloud CLI. |
| Click path | The steps a tester clicks to see the fix. | "On QA: Settings, then Export, then Download." |
| Client | The organisation that owns the platform. The author works for it through a consultancy. | `<CLIENT>` in the pack. |
| Closed | The last Bug state: fix verified by a human. Only the tester writes it. | The tester retests, then writes Closed. |
| Code freeze | A period when only critical fixes merge. | Before go-live. |
| Commit | A saved snapshot of changes, with a message. One per repo per ticket. | `fix(scope): stop the crash (BUG-12345)` |
| Compaction | Shrink a long chat into a summary to free room. | The agent calls `compact_context` when you ask. |
| Conflict (merge conflict) | Two changes touched the same lines and git cannot choose. | `/conflict 4567` |
| Consultancy (employer) | The firm that employs the author and sends them to the client. | `<EMPLOYER>` in the pack. |
| Context window | How much text the model can hold at once. | A long chat can overflow it. |
| Contract gate | Session B's first check: is the contract whole? If not, stop and send the story back. | Missing stop conditions fails it. |
| Control prompt | A prompt that must still behave right after a fix. It guards against over-fixing. | A prompt that must still call a tool. |
| Conventional Commits | A title format: `type(scope): description`. | `fix(prompt-ideas): filter by direct match (BUG-12345)` |
| Cron | A clock-based job runner. | `board-ingest` runs on weekday mornings. |
| Cross-wiring | A service talks to the wrong sibling, often from another branch. Health stays green. | `lsof` shows the PID's cwd is another worktree. |
| CSS selector | A pattern that picks one element on a web page. | The Playwright MCP takes a snapshot ref or a CSS selector. |
| curl | A command that makes a web request. | `curl localhost:5173` proves the dev server answers. |
| cwd | Current working directory: the folder a command runs in. | The harness reads `<cwd>/.omp`. |
| Daily work poll | A report of what you did on a day, from the tracker, local review folders, and git history. | "What did I do on Tuesday?" |
| DAP | Debug Adapter Protocol. How the agent talks to a debugger. | `harness/project/dap.json` |
| Debugger | A tool that pauses a running program so you can look at real values. Better than print statements. | Set a breakpoint, re-fire the request, read the values. |
| debugpy | The Python debugger server. | Start it with `--wait-for-client`. |
| Decision page (ADR) | A vault page for one choice: Decision, Context, Reasoning, Consequences. | `vault/examples/decisions/` |
| Definition of Ready / Done | Team checklists: when a story may enter a sprint, and when it counts as done. | No unrefined story enters planning. |
| Deploy order | Which repo ships first. The contract says what a user sees in each order. | A fix in two repos has three orders: A first, B first, together. |
| Dev, QA, prod | Three environments. Dev is for developers, QA for testers, prod for real users. | Dev sits behind a private endpoint. |
| Diff | The list of changes between two versions of the code. | `git diff origin/main...HEAD` |
| Director (vibe mode) | A mode where the main agent only reads and hands work to workers. | `vibeExtraTools` adds tools back to the director. |
| Discriminating step | A flow step whose result differs between the broken and the fixed build. The verdict looks only at these. | `discriminating: true` |
| DM | Direct message in Slack. | Merge asks go by DM, never to a channel. |
| Docker (compose) | Docker runs apps in containers. Compose starts several from one file. | The orchestrator needs a database container. |
| Draft | Text shown in a fenced block before it is posted. Nothing is sent yet. | A Slack draft waits for "send it". |
| Draft PR | A PR marked not ready: no auto-complete, no Slack line. | Opened when a security finding is too big for this PR. |
| Drift | Two things that should match no longer match. | The vault says review. The tracker says Active. |
| Dry run | Show what would happen. Change nothing. | `scripts/cleanup-task-folders.sh` without `--apply`. |
| e2e (end to end) | A test that goes through the whole path, from the screen to the storage. | The API e2e regression pipeline. |
| Elicitation | A tool asking a human for a missing choice. It fails when nobody is there. | A tracker call with no `project` in a cron run. |
| .env file | A text file of settings and secrets for one repo. Agents never read it, print it, or copy it. | One `.env` sits at the bare-repo root. Each worktree links to it. |
| .env.local | A second env file the agent may manage. Its first line is a fixed marker. No secrets inside. | Non-secret local overrides only. |
| Escalation | Stop, comment with proof, tag a person, and set the state to Blocked. | The code contradicts the contract. |
| Evidence | Proof you can re-run: command output, a diff, a screenshot. | Failing test output under `## Failing test`. |
| Exfiltration | Sneaking data out of a system. | A change that posts secrets to a stranger's server. |
| Exit code | The number a program returns. 0 means fine. | `scripts/secret-scan.sh` exits 1 on findings and 2 on a usage error. |
| expect (flow) | What a flow run must see: `broken` on the pre-fix build, `fixed` on the fix branch. | Run 1 uses `expect: broken`. |
| Extension | A TypeScript file the harness loads at start. It adds tools or guards. | `harness/extensions/global/guardrails.ts` |
| Fail closed / fail open | Closed: on error, block. Open: on error, allow. Guards should fail closed. | The approval gate blocks governed tools if its config is unreadable. |
| Fail-first | Another name for test first: the new test must fail before the fix. | Record the failing output. |
| Failure boundary | The exact place where the bad thing really happens. Test there, not behind a proxy. | Call the backend directly, not through the dev proxy. |
| Fall | A story of something that went wrong, with its fix and the law it made. | "Merged in fifteen seconds." |
| False positive | A scan hit that is not a real problem. | A test key in a fixture. |
| FastAPI, FastMCP | Python frameworks for web APIs and for MCP servers. | `orchestrator` uses FastAPI. |
| Feedback thread, chit-chat thread | Merge-flow classes of an open PR thread. Feedback asks for a change and blocks. Chit-chat asks for nothing, and the human decides. | A thank-you comment is chit-chat. |
| Fenced block | A code block between triple backticks. All drafts go in one. | A Slack draft in a fenced block. |
| Fetch refspec | A rule that maps remote branches to local refs for `git fetch`. Bare clones have none. | `+refs/heads/<b>:refs/remotes/origin/<b>` |
| FETCH_HEAD | Git's note of the last fetch. A plain fetch in a bare clone updates only this. | Use an explicit refspec instead. |
| Flow | A step list in `flow.yaml` that a cheap vision model follows in a browser, then returns a verdict. | Three runs: broken, fixed, QA. |
| flow-runner | The subagent that runs one flow, in one environment, with one expectation. | `agents/flow-runner.md` |
| Force push | Overwrite a remote branch with your local one. Dangerous. | Never `--force`. Use force-with-lease. |
| Force-with-lease | A safer force push. It fails if someone else pushed meanwhile. | Only on your own amended branch. |
| Frontmatter | The header block at the top of a Markdown file, between `---` lines. | `type: task`, `status: doing` |
| Gate | A point where the agent must stop and ask, or must prove facts before going on. | The verification gate before a PR. |
| get_type | The tracker call that returns a work item type's real states and rules. | Read the Bug ladder with it. Never assume. |
| gitleaks | A tool that scans commits for secrets. | `scripts/secret-scan.sh` runs it. |
| Go or No-Go | The launch decision. One named person confirms it. | The launch plan names who says Go. |
| Go-live | The day real users get the product. | A code freeze comes before it. |
| Grilling | One hard question per turn, each with a recommended answer, grounded in code. | "The ticket says X, but `file:line` does Y. Which wins?" |
| Guard | Code that checks a tool call before it runs. It can block, ask, or allow. | `harness/extensions/project/no-parent-folder-guard.ts` |
| Guard line | A fixed log line a job checks, so it skips work already done. | `board scan <date>` in `log.md` |
| Guardrails | The global extension that hides secrets and blocks key files. "A guardrail, not a sandbox." | `harness/extensions/global/guardrails.ts` masks values as `*****`. |
| GUID | A long unique id. | Creating a PR needs the repository GUID. |
| Handoff doc | A page for a reader with no context. | The tester handoff page (see `skills/post-merge/SKILL.md`). |
| Harness | The program that runs the agent: prompt, tools, skills, rules, model calls. | OMP. |
| Headless | Run with no screen and no person. | `omp -p` in a cron job. |
| Health check | A request that asks a service "are you alive?". Green does not prove it runs the right code. | A green stack served another branch. |
| Hook | A place where an extension can step in: before a tool call, at turn end. | The `tool_call` hook. |
| HTTP status code | A number a web server returns: 200 fine, 400 bad request, 401 not signed in. | A state jump returned 400. |
| hub | A harness command that starts and stops named processes. A direct `hub` start needs the human's approval. The `services` tool is the default door. | `hub start` timed out waiting on a dev server. |
| Idempotent | Safe to run twice. Same result. | `scripts/setup-task-branch.sh` reuses existing worktrees. |
| Inbox (task status) | A task you have not yet decided to do. | Meeting action items land here. |
| Incident owner | The person named to run the response to an outage. | Named before go-live. |
| Index (`index.md`) | The vault's table of contents. Read it first. | `vault/index.md` |
| [INFERENCE] | An inline tag on a claim nobody verified. | "The cause is a cache. [INFERENCE]" |
| Ingest | File a new source into the vault: raw, source page, links, index, log. | `wiki-ingest` |
| Integration test | A test that uses real dependencies, not mocks. | Marked `integration`. Not in the PR build. |
| Iteration (path) | The tracker's sprint slot for a work item. Not the board. | `System.IterationPath` |
| JWT | JSON Web Token: a signed login token. | `file-gateway` checks one on its routes. |
| Kebab-case | Lowercase words joined by hyphens. | `fix-meter-reading-rounding` |
| Key name (secret by name) | The agent passes a name like `TEST_USER_PASSWORD`. The tool types the real value and hides it. | The secret never enters the model's context. |
| kill, pkill, killall | Commands that stop processes by id or by name. The guard always blocks `pkill` and `killall`. It blocks `kill` unless the target is a literal PID this session started. | `kill $(lsof -ti :PORT)` is blocked. |
| Known gaps | A decision page section that lists what is not proven. The early warning for drift. | Turn each gap into a task or an owner. |
| Lane (review lane) | One reviewer's slice: security, quality, or architecture. Read-only. | Three lanes run in parallel. |
| Ledger | A list of processes this session started. Only these may be stopped. | `process-ownership-guard` |
| Light check | A fast secret scan before any push. A finding triggers the full security gate. | `scripts/secret-scan.sh` before an amend and force-push. |
| Lint | A tool that flags style and error patterns in code. The vault has its own lint. | `pnpm run lint`, `wiki-lint` |
| Live verification | Prove the fix against real services, not mocks. | A real model call and a real blob read. |
| Localhost | This computer, as a network name. The IPv6 loopback is the same machine over IPv6. | The web app runs at `localhost:5173`. |
| Lockfile | A file that pins exact package versions. Regenerate it, never hand-merge. | `pnpm-lock.yaml` |
| Log (`log.md`) | The vault's append-only event list. | One header per write: date, op, title. |
| lsof | A command that lists the files and ports a process uses. | `lsof -nP -iTCP:5173 -sTCP:LISTEN` |
| LSP | Language Server Protocol. It gives the agent go-to-definition, references, and errors. | `scripts/setup-task-lsp.sh` wires it. |
| Main agent | The one session you talk to. | It delegates to workers and holds the gated writes. |
| `main` (trunk, folder) | The protected shared branch. Also a folder in the tasks root with repo links synced to `main`. | Read current main from the `main` folder. |
| Markdown, HTML | Two text formats. A tracker field uses one. Match it when you write. | An HTML field needs an HTML contract. |
| Mask | Replace a secret with `*****` in tool output. Never write the mask back to a file. | A `.env` read shows `*****`. |
| MCP | Model Context Protocol: a way to plug tool servers into the agent. | Azure DevOps, Slack, Playwright. |
| Merge status | The tracker's flag for whether a PR merges cleanly: conflicts or no conflicts. | Show the words, never the number. |
| MERGE_HEAD | A marker that a merge is in progress. | `stash pop` once dropped it. |
| MFA | Multi-factor authentication: a second proof at sign-in, such as a code. | Prompts varied between test runs. |
| Mock | A fake stand-in for a dependency in a test. It holds your guess. | A mock rejected on abort. The real library resolved. |
| Mode preset | One key that sets the model and a mode (plan, vibe, goal). | Ctrl+0 to 4. Key delivery is not confirmed. |
| Model role | A named slot in the config that picks a model for a job: planning, small tasks, advisors, auditor. | `modelRoles` in `harness/global/config.yml`. |
| `move_session` | The tool that moves the session into a task folder. | It moves only to the launch folder or a direct child. |
| Mutation check | Remove the fix: the new test must fail. Restore it: the test must pass. | It proves the test guards the fix. |
| Nit (severity) | The lowest advisor level: a hint. | The scribe's note after a write. |
| OBO (on-behalf-of) | A login flow where a service swaps your token for a new one, to call another service as you. | A backend reads your file through a second service, as you. |
| Obsidian | A note app that opens a folder of Markdown files as a vault. | It makes `vault://wiki/` resolve. |
| Obsidian Bases | Obsidian's saved tables over page header fields. See `.base` file. | `vault/views/` |
| OIDC | OpenID Connect: the standard "sign in with your account" flow. | The web app signs in through OIDC. |
| OMP | oh-my-pi: the terminal coding-agent harness the author used. | `omp -p` runs one headless prompt. |
| .omp folder | The project folder where the harness reads settings, skills, rules, and MCP servers. It reads only `<cwd>/.omp`. | `<tasks-root>/.omp/` |
| Optional reviewer | A reviewer who may vote but never blocks the merge. | The API can add only optional reviewers. |
| orchestrator | Two meanings. The repo: the backend API that runs the assistant's LLM agent. Also the main agent that hands work to workers. | "The orchestrator re-reads every worker diff." |
| Orphan (page, process) | A vault page nothing links to, or a process left running. | `wiki-lint` lists orphan pages. |
| Overlay | A config layered over defaults for one run. | The cron jobs use one that denies write tools. |
| Pack | The folder of files this book describes: skills, rules, scripts, harness, vault kit. | Every section says where in the pack. |
| Paired PRs | One fix split across PRs, titled `(k/n)`. Merge order matters. | Merge `(1/2)` before `(2/2)`. |
| Papercut | A small thing that costs time. Log it in one line. | Date, symptom, fix, project. |
| PAT | Personal access token: a long password for a tool. Never print it. | Held base64 encoded in an env variable. |
| Pending PO Review | A Story state after the tester passes it. The product owner decides next. The agent never writes it. | The tester moves a story here. |
| PID | Process id: the number of a running process. | `lsof` shows the PID on a port. |
| PII | Personal data that identifies a person. | A home address or a phone number. |
| Pipeline | A scripted build, test, or deploy run on a server. | The PR build. The deploy pipeline. |
| Placeholder | A `<NAME>` token you replace with your own value. | `<ADO_ORG>` |
| Plan mode | A harness mode that plans before it edits. | A plan-only hook injects house rules. |
| Playwright | A browser automation tool, used through MCP. | `flow-runner` drives it. |
| pnpm | A Node package manager. `npm` is blocked here. | `pnpm install --frozen-lockfile` |
| Policy | A tracker check a PR must pass before it merges. | Required reviewers, a build, a linked work item. |
| Poller | A job that checks a status again and again. | A design to watch PR status. Not built. |
| Port | A numbered door a service listens on. One owner per port. | `web-app` on 5173. |
| PR (pull request) | A request to merge a branch into `main`, with review. | PR 4567. |
| PR status | Active, Abandoned, or Merged. Say the word, never the code. | A merged PR shows Merged. |
| PR status card | The one fixed card `/pr-status` prints for your open PRs. | Votes, comments, checks, one state line. |
| PR template A and B | The two PR description shapes. A is for bug fixes. B is for features and chores. | A has Bug, Root cause, Fix, Tests, Evidence. |
| PR-build checks | The commands the PR pipeline runs: lint, typecheck, tests, build. Run them locally before every push. | `pnpm run lint`, `pnpm run test:ci` |
| PR-open line | The one fixed Slack line posted when a PR opens. No draft, no approval. | `PR 4567 for review (orchestrator): ...` |
| Private endpoint | A network address reachable only from inside a private network. | Dev answers only from a remote desktop. |
| Probe (with a control) | A test call that checks a service is alive. A control proves the probe can tell good from bad. | A bogus credential must fail the expected way. |
| Product owner (PO) | The person who accepts a story. | Writes Accepted. |
| Project agents (pr-security, error-detective, architect-reviewer) | Read-only helpers. `pr-security` rules on security findings. `error-detective` correlates logs across services. `architect-reviewer` checks boundaries and contracts. | `agents/pr-security.md` |
| Prompt | The text you give the model. | "Work Bug 12345." |
| Prompt injection | Text that tells the AI to ignore its rules. The auditor looks for it. | A comment that says "ignore previous instructions". |
| Proxy (dev proxy) | A local server that forwards requests. It can hide a client disconnect. | Test the backend port directly. |
| PRSecurity | The dormant advisor that wakes when the `pr-review` skill loads. | It watches for fails-open findings during a review. |
| QA tester | The person who retests fixes and closes bugs. | Writes Closed on a Bug. |
| Raw (`raw/`) | The vault folder for untouched originals. | A pasted transcript. |
| Re-fetch | Read an item again after a write, to see the real state. | A write's success reply is not proof. |
| React, Vite | React builds web screens. Vite is its dev server and build tool. | `web-app` uses both. |
| Read-only | Allowed to look, not to change. | Review lanes. |
| Ready for Fix | A Bug state: the bug reproduced. It stays here while the PR is open. | The agent writes it after the repro. |
| Ready for Retest | A Bug state: the fix is on QA and the tester may retest. | Written after the ancestry check passes. |
| Ready for Test | A Story state: every PR merged. QA deploy not yet proven. | The agent writes it after the merge. |
| Rebase | Replay your commits on top of another branch. This pack never rebases to fix a PR conflict. | Merge the target in instead. |
| Refinement | Make a story clear enough to build: grill the author, write the contract. | Session A. |
| Regex | A pattern language for matching text. | `(?m)^foo` matches at each line start. |
| Regression test | A test that fails if an old bug comes back. | Every bug fix adds one. |
| Repo onboarding | Make a bare clone and a `main` worktree for a repo that has none. | `skills/repo-onboarding/SKILL.md` |
| Repo roles | Names for the platform's repos: `orchestrator`, `media-mcp`, `data-mcp`, `file-gateway`, `web-app`, `infra`, `legacy-agent`. | `web-app` is the React and Vite front end. |
| Repro (reproduction) | The exact steps that show the bug. | No repro, no fix. |
| Required reviewer | A reviewer whose approval blocks the merge until given. | Make the reviewer required before you arm auto-complete. |
| RESEARCH-00000 | The task folder prefix for work with no ticket. | `RESEARCH-00000-blob-owner-check` |
| Resolved | A Bug state: fixed, not yet verified. Written once every linked PR merged. | The agent writes it after the merge. |
| Retro (retrospective) | A team meeting about what to keep, stop, and start. | A retro gave twelve action items. |
| Returned bug | A bug the tester moved back after a fix. | It starts at Step 0. |
| `/rev` test | A tracker write guard: update only if the revision is still the one you read. | Optimistic concurrency. |
| Review mode (agent-end) | An advisor setting: review once per finished run, not once per tool round. | `reviewMode: agent-end` cut reviews about nine times. |
| Rock rule | A one-line law taken from a fall. | "Whoever starts it owns it." |
| Root cause | The real reason the bug happens. Name the file and line. | "The check runs only in `catch`." |
| Roster | The list of skills or advisors the harness knows. | The skill roster shows name and description. |
| Router skill | The skill that maps a ticket to the chain of other skills. | `workflow-router` |
| Rule | A law file. Always on, or on when text matches. | `rules/global/read-tool-first.md` |
| Rung | One step on a state ladder. | Write one rung per call. |
| Sandbox | A throwaway copy for tests. | Test scripts on synthetic bare repos. |
| SAS URL | A storage link with an access token built in. Never post one. | The auditor marks it UNSAFE. |
| SAST | Static application security testing: scan code without running it. | Checkmarx. |
| Schema (vault) | The contract file for vault pages. | `vault/schema.md` |
| Scoped rule | A rule with a `condition` regex and a `scope`. It fires only when text or a tool call matches. | `rules/project/ado-area-path.md` |
| Scout | A read-only helper that finds code for a ticket. | Triage uses scouts. |
| Scribe (WikiScribe) | The advisor that files durable facts into the vault. | It writes notes, decisions, and log lines. |
| SDD spec | The spec that `/triage` writes into a ticket: requirements, ACs, and tasks by tier and wave. The pack does not expand "SDD". | A tasks table with Tier, Executor, Wave. |
| Secret scan | A check that finds keys and passwords in a diff before a push. | `scripts/secret-scan.sh` |
| Secrets file | The file that holds test credentials. Every read tool is blocked from it. | The Playwright MCP reads it, not the agent. |
| Security gate | The pre-PR check: a secret scan plus a `pr-security` ruling per finding, with fix or defer rules. | `skills/pr-security-gate/SKILL.md` |
| Self-review | A script that writes your diff and flags new code comments, env files, dependency changes, and secrets. | `scripts/self-review.sh` |
| Services tool | The custom tool that starts, stops, and checks the five local services and keeps a ledger. | `services` with `action: start`. |
| Services tool codes | Named results of the `services` tool, such as `port_in_use`, `health_failed`, `docker_unavailable`. | `health_failed` leaves the process up for a look. |
| Session | One run of the harness, from start to close. | One ticket, one session. |
| Session A / Session B | The two halves of a story. A: grill and write the contract. B: start blank and build from the ticket. | A ends at Ready for Development. |
| Session tools | `end_session`, `clear_context`, `compact_context`. The agent calls them when you ask in plain words. | "Close the session." |
| Severity | An advisor's level: blocker, concern, nit. | A blocker means fix it now. |
| SHA | A commit's long id. | A squash SHA names the merged commit. |
| Shell cap (300 s) | The shell tool kills a command after 300 seconds. `timeout` raises it. `async` does not. | Clean three or four folders per call. |
| Sibling (service) | Another service that the first one calls. | Sibling URLs are set with prefixed variable names. |
| Skill | A recipe file. Name and description sit in the prompt. The body loads on demand. | `skills/bug-workflow/SKILL.md` |
| Skill drift | Skills that contradict each other or the code. | The router skipped seven skills. |
| Slash command | A short prompt template that starts with `/`. | `/bug 12345` |
| Slug | A short kebab-case name made from a title. | `add-retry-to-export-job` |
| Smoke test | A tiny test that shows the thing runs at all. | One case must fire. One must pass. |
| sourceVersion | The commit a build used. | The deployed commit is the build's `sourceVersion`. |
| Sprint | A fixed time box of planned work. | Stories enter at sprint planning. |
| Squash merge | Merge all PR commits into one commit on `main`. The PR title becomes the message. | Every repo here squashes. |
| SSO | Single sign-on: one account for many apps. | The web app signs in through SSO. |
| Stale (build) | A build that passed but is out of date, because `main` moved or a newer push has no run. | The policy build expired. |
| Standing exclusion | A repo the wiring script always skips. | `legacy-agent`, set in the `excluded_repos` array of `scripts/setup-task-branch.sh`. |
| Standing reviewer | A person added as an optional reviewer on every PR. | The tech lead. |
| Stash | Shelve uncommitted changes with `git stash`. | Never stash during a merge. |
| State ladder | The ordered list of states for a work item type. | Bug: New to Closed. |
| Stop condition | A named case that forces the implementer to stop, comment, and set Blocked. | The code contradicts a contract item. |
| Story (User Story) | A work item for new behaviour. | Story 12346. |
| Story states | The ladder: Backlog, In Refinement, Ready for Development, In Development, Ready for Test, In Test, Pending PO Review, Accepted. Side states: Blocked, Removed. | The agent never writes the last two rungs. |
| STORY- | The task folder prefix for a Story. Old notes say `US-`. They are stale. | `STORY-12346-memory-prompt-guard` |
| Stray | A loose file or folder in the tasks root that is not on the keep list. | A stray report folder. |
| Stream rule (TTSR) | A rule that fires while the model is still writing, by matching partial text. A tripwire. | The path rule that fired 37 times in four days. |
| Subagent | A short-lived helper agent with a narrow brief and no shared memory. | One worker per repo. |
| Superseded | Replaced by a newer item. A decision page is `superseded`. A PR thread is superseded when its commenters approved later. | `status: superseded` |
| Symlink | A file that points to another path. | Repo entries in a task folder. |
| System prompt | The text the harness gives the model before your message. | `harness/global/APPEND_SYSTEM.md` adds to it. |
| System thread | A PR thread the system made, not a person. Skip it. | A vote update thread. |
| T-shirt size | A rough size: S, M, L. Used before design starts. | Size a new request before you design it. |
| Tag (git tag, work item tag) | A label. A git tag can trigger a deploy. | A `v*` tag. |
| Task folder | One folder per ticket with repo links, plan, docs, and review. | `BUG-12345-prompt-search-mismatch` |
| Tasks root | The one folder where you start every session. | `~/work/<PROJECT>/tasks` |
| TBD | "To be decided." Banned in an Agent Contract. The gate rejects it. | A contract with `TBD` fails Session B's gate. |
| TDD | Test-driven development: write the test first. | The pack's name for it is test first. |
| Teach-back | You explain the ticket in your own words. The agent compares. | The triage gate. |
| Teardown | Stop and clean up everything you started. | Close the browser. Stop the services. |
| Tech lead | The technical lead. A standing optional reviewer on every PR. | `<TECH_LEAD>` in the pack. |
| Tenant | An organisation's own space in a cloud login system. | The test user lives on the consultancy's tenant. |
| Terraform | A tool that builds cloud resources from text files. | `infra` is Terraform only. |
| Test first | Write the test, watch it fail, then fix. | Failing output goes in the plan. |
| Test user | A login made for tests, on a tenant you control. | The agent logs in as it by itself. |
| TF401181 | The tracker's error for a PR that already completed. | You armed auto-complete too late. |
| Thread (PR thread) | A chain of comments on a PR. Only the starter closes it. | Leave it Active after your fix. |
| Thread status | Active, Resolved, Won't Fix, Closed, By Design, or Pending. | Say Resolved, not `fixed`. |
| Tier (Big, Mid, Small) | Model size classes. Big for design, Mid for scoped work, Small for mechanical work. | A Small model runs flows. |
| Tool call | One use of a tool by the agent, such as `read` or `bash`. | A guard checks it before it runs. |
| toolApprovalConditions | A config block that sets allow, prompt, or deny per tool, with ordered rules. Global defaults merge with the project block. | Work-item writes fall back to allow. |
| TOTP | Time-based one-time password: six digits that change every 30 seconds. | `automation/playwright/totp.mjs` |
| Tracker | The system that holds tickets. | ADO. |
| Triage | Study a ticket, check it against code, and decide what to do. | `/triage 12345` |
| Trunk-based | Everyone merges small changes into `main`. Branches live short. | No long-lived feature branches. |
| TTSR | OMP's name for a stream rule. See Stream rule. | A rule that fires mid-stream. |
| Turn | One message from you and the agent's answer. | About 7.8 assistant messages per human turn. |
| Typecheck | A tool that checks types in code before it runs. | `pnpm run typecheck` |
| UAT | User acceptance testing: users try the product before release. | A UAT environment that reuses QA hides faults. |
| Unattended | Runs with no human watching. | The cron jobs. |
| Unit test | A test of one small piece of code. | A test file next to a component. |
| UTC | World clock time. The tracker stores times in UTC. | Pin a date range twice: UTC for the tracker, local for files. |
| uv | A fast Python package and project manager. | `uv sync`, `uv run pytest` |
| uvicorn, venv | A venv is a folder with one project's Python packages. Uvicorn runs a FastAPI app. | Launch through the venv's uvicorn, with no `--reload`. |
| validated (flow) | A block the runner writes into a flow after run 1 returns broken. It proves the flow can see the bug. | No `validated` block, no `expect: fixed` run. |
| Vault | The personal wiki. | `vault://wiki/` |
| Vault URI | The `vault://wiki/<path>` address agents use for vault pages. | `vault://wiki/schema.md` |
| Verdict | A clear result line: clean or findings, pass or fail. | `VERDICT: clean` |
| Verification gate | The list of proofs that must pass before a PR opens. | Build, tests, live run, mutation check, self-review, security gate. |
| VM (virtual machine) | A computer that runs inside another computer. | The Docker VM must be up for the database container. |
| Vote | A reviewer's PR answer: approved, approved with suggestions, waiting for author, rejected. | Not merge authority. |
| Waiver | A written decision to accept a known gap, with a reason. | A false-positive class documented in a PR. |
| Wave | A group of tasks by dependency order. Same-wave tasks may run in parallel. | Wave 1 has no dependencies. |
| Wiki | A set of linked pages you keep up to date. | The vault. |
| Wikilink | `[[folder/page]]`: a link between vault pages. | `[[people/jane-doe]]` |
| WIQL | Work Item Query Language: SQL-like queries for the tracker. | `SELECT [System.Id] FROM WorkItems` |
| Work item | One tracker record: a Bug, a Story, a Task. | Bug 12345. |
| Worker | A subagent that implements. One per repo. | A worker gets a self-contained brief. |
| Worktree | A second checkout of a repo on its own branch, sharing history. | `<repo>-bare/fix/<slug>` |
| YAML | A text format for settings, using indentation. | `harness/global/config.yml`, `flow.yaml` |

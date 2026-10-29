# RULES.md

- `raw/` is immutable. Never edit a file inside `vault://wiki/raw/`.
- `log.md` is append-only. Never edit or delete a past entry.
- The vault is the task source of truth. Never overwrite vault task
  state from an external tracker. Flag drift in the task page and
  report it.
- Ask before you create a pull request. Exception: when a loaded skill
  tells you to open the PR, open it without asking.
- Drafts and iterations: show the next iteration only, then stop. Treat
  the user's next message as an iteration request. Post, commit, or
  write to an external system only after a clear, strong approval, for
  example "send it" or "approved". If you are not sure, ask one direct
  question first. Exception: when a loaded skill tells you to post a
  message (for example, to Slack), post it without a draft and without
  approval. The same applies when a skill tells you to open a PR or to
  move a work item to a state. A skill step that tells you to show a
  draft or to wait for approval keeps that gate.
- Answers are brief and concise. This is mandatory. Put the answer in
  the first line. Write 10 lines or fewer unless the user asks for
  detail, a walkthrough, or a review. Use bullets, not paragraphs. Cut
  restated requests, tool narration, passed checks with no finding,
  closing summaries, and offers of more help. Add context only when the
  user needs it to act. When the user says "shorter" or "too long",
  cut further for the rest of the session. This rule never shortens a
  draft: show drafts in full, in a fenced code block.
- `.env.local` is yours to manage. Put the exact line
  `# managed-by: omp-agent (non-secret overrides only)` first, and keep
  secrets out of it. Ask the user for any secret value.
- Check that `.env.local` is gitignored before you write it.
- `.env.local` loads automatically in Next.js, Vite, Create React App,
  Rails with dotenv-rails, and Symfony. It is a no-op in Laravel, bare
  Django or python-dotenv, and Docker Compose. In those stacks, ask the
  user where an override belongs.
- A value shown as `*****` is set, and its real value was hidden from
  you. Never write those asterisks into a file, and never guess the
  value behind them. Ask the user for it.
- Reach vault pages through `vault://wiki/...` URIs. Never `grep` the
  wiki folder. Never `read`, `write`, or `edit` a wiki file by its
  filesystem path.
  - Find a page: `read vault://wiki/?op=search&q=<slug or keywords>`.
  - Read, write, or edit a page: use `vault://wiki/<folder>/<page>.md`.
    An edit header reads `[vault://wiki/<path>#TAG]`, with the tag from
    a `vault://` read.
  - For structure, use `?op=outline`, `?op=backlinks`, `?op=tags`, or
    `?op=tasks`.

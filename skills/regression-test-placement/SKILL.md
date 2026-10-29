---
name: regression-test-placement
description: Use when a bug fix or a story AC needs a regression test and you must decide where it goes (repo tests, contracts.py, prompt catalogue, media check, component test, browser journey) and how to prove it before the PR.
---

Every bug fix and every behaviour AC adds a regression test. The kind of
thing that broke decides where the test lives. Test first: write the test,
watch it fail, then fix, then run the mutation check in the calling workflow.

## Placement table

| What broke | Test goes here | Runs | Procedure |
|---|---|---|---|
| A function, parser, tool | the repo's `tests/` folder | every PR | Write the failing test first. Smallest fix. Mutation check (bug Step 4 / story Step 5). |
| A field the API sends (new or changed) | `orchestrator/e2e/support/contracts.py` | every PR (mock e2e in `azure-pipelines-pr.yml`) | Add the field to the matching `Contract` model. The base `Contract` uses `ConfigDict(extra="forbid")`, so an unlisted field fails. Run `uv run pytest e2e --no-cov` (mock mode, no secrets). |
| What the assistant says or does for a question | `orchestrator/e2e/catalogue/prompt_regression.json` | nightly on dev (pipeline `<E2E_PIPELINE_ID>`, `orchestrator-api-e2e-regression`, cron 02:00 on `main`); every PR runs `e2e/test_catalogue_rules.py` on the JSON shape only | See "Adding a catalogue case" below. |
| A deck, Word document or image the assistant makes | `orchestrator/e2e/test_media_generation.py` | nightly on dev (same pipeline `<E2E_PIPELINE_ID>`), live mode only | Add a check that fetches the file through the `files` fixture (`files.get(f"/{kind}/{info['url']}")`, base `E2E_FILES_BASE_URL`) and inspects it with python-pptx (`Presentation(io.BytesIO(...))`) or python-docx (`Document(io.BytesIO(...))`). |
| A screen or button in web-app | a test next to the component (`*.test.tsx`) | every PR (`pnpm run test:ci`) | Add the case. Run `pnpm run test:ci`. |
| A journey in web-app (tabs, drafts, library) | `web-app/browser/*.spec.ts` (Playwright, `pnpm run test:browser`) | not in any pipeline today (checked all `azure-pipelines-*.yml` on `main`, 2026-10-16) | Promote the task folder's `docs/flow.yaml` into a spec next to the six existing ones. State in the PR description that CI does not run it. |

## Mutation check per stack

Remove the implementation, keep the test, run the single new test (must
fail), restore the implementation, run again (must pass). Record both outputs
in the plan. Pick the form by whether the fix is committed:
`git -C <repo> diff --quiet HEAD -- <implementation files>` exits 1 when the
fix is uncommitted, 0 when it is committed. `stash push` on a committed fix
saves nothing and `stash pop` then restores an unrelated stash, so never use
the stash form on a committed fix.

| Stack | Single-test command |
|---|---|
| Python (`uv`) | `uv run pytest <test file>::<test name> --no-cov -q` |
| web-app (vitest) | `pnpm exec vitest run <test file> -t "<test name>"` |
| web-app browser (Playwright) | `pnpm exec playwright test <spec file> -g "<test title>"` |

Uncommitted fix:
```
git -C <repo> stash push -- <implementation files>
<single-test command>    # must FAIL
git -C <repo> stash pop
<single-test command>    # must PASS
```

Committed fix (after a commit or amend, or a returned bug):
```
git -C <repo> checkout origin/main -- <implementation files>
<single-test command>    # must FAIL
git -C <repo> checkout HEAD -- <implementation files>
<single-test command>    # must PASS
git -C <repo> status --short   # must show no change
```

## Adding a catalogue case

Case shape (verified in `e2e/catalogue/README.md`):

- `id`: `regression.<area>.<slug>`.
- `"source": "regression"`.
- `prompt`.
- `guards`: `"PR <n> (ticket <n>): <what broke>"`.
- `setup` (optional): prompts sent first in the same chat.
- `requires` (optional): for example `["azure_devops"]`.
- `expect`: keys the runner checks are `completes`, `tools_any`,
  `tools_none`, `cites` (`required` / `optional` / `forbidden`),
  `cites_min`, `artefact` (`chart`, `artifact`, `presentation`, `word`,
  `image`), `survives_reload`, `max_seconds`, `min_chars`, `one_of`,
  `no_raw_stack_trace`, `chat_title_not_empty`, `ends_mid_token`.
- Every case needs `max_seconds`. Treat it as a budget and keep it generous.

Example (verbatim from the e2e guide):

```json
{ "id": "regression.answer.drafted_email_is_not_cut_short", "source": "regression",
  "prompt": "Draft a short email asking our suppliers to please confirm their delivery dates for November by Friday",
  "guards": "PR 4567 (ticket 12345): a drafted email was cut short",
  "expect": {"completes": true, "tools_none": true, "min_chars": 150, "one_of": ["contains:Subject"]} }
```

Update the counts in `e2e/test_catalogue_rules.py`:

- Line 15: `assert len(cases) == 149`.
- Line 34: `assert by_source == {"regression": 42, "prompt_catalogue": 107}`.
- Line 40: `assert len(catalogue.select("all")) == 149`.

Each new regression case adds 1 to the total and 1 to `regression`.
`e2e/catalogue/README.md` still says 133/26. The test is the truth.

Prove it before the PR, against the fix, not against dev:

1. Start the local orchestrator (`service-startup-reference`).
2. Run:
   `E2E_MODE=live E2E_BASE_URL=http://localhost:<port> E2E_TOKEN=<token> E2E_CATALOGUE=regression uv run pytest e2e/test_prompt_catalogue.py -k <case id> -v --no-cov`
   The token comes from the local login path in
   `e2e-verification`.
3. Record the output in the fix plan.
4. Run `uv run pytest e2e/test_catalogue_rules.py --no-cov` to prove the JSON
   shape and the counts.

Do not run pipeline `<E2E_PIPELINE_ID>` against DEV before the merge. DEV runs `main`, so the new
case fails there until the fix deploys. `post-merge` runs it after the
dev deploy.

## Boundaries

- Read-only on pipelines before the merge.
- Never edit a `prompt_catalogue` case to make a regression pass.
- Never lower a count.
- Never delete a case without a ticket.

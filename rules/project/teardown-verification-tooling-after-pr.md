---
name: teardown-verification-tooling-after-pr
description: "Close Playwright sessions and stop dev/services started for verification once the PR is created, unless told to keep them running"
condition: "\\\"action\\\":\\s*\\\"create\\\""
scope: "tool:mcp__azure_devops_repo_pull_request_write"
---

After a PR is created, verification tooling is done unless the user explicitly asks to keep it running.

- If a Playwright browser session was opened to live-verify the fix and no other process needs it, close it (`browser_close`) right after the PR is created.
- If a dev server or backend service was started for verification (with `services` or `hub start`), stop it with the same tool (`services` `action: stop`, or `hub stop`) right after the PR is created.
- Do not leave these running into the PR-notification or ADO-linking steps. Tear down first, then continue the workflow.
- Exception: only skip teardown if the user explicitly says to hold onto the session or service.

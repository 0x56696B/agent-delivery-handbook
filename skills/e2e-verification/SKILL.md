---
name: e2e-verification
description: Use when a platform fix or feature needs proof against real Azure OpenAI/Blob/Mongo calls, not just unit tests or code reading — covers each service's local auth bypass (or lack of one), verifying Word/PPTX generation via the real Blob container, and director-level HTTP verification without bash access.
---

Prerequisite: the services you need are already running — see
`service-startup-reference` for start/debug commands and the canonical
port map.

## Auth for testing without real Azure AD

- **orchestrator has a local-dev bypass.**
  `AuthConfig.fake_auth_token` (env var `FAKE_AUTH_TOKEN`, no prefix) — any
  request with `Authorization: Bearer <that value>` is treated as a fixed user
  with `oid`/`user_id` = `"fake-user-id"` (see
  `app/utils/auth.py::validate_azure_token`). Get the configured value via the
  app's own loader, not by catting `.env`:
  ```
  uv run python -c "from app.config import auth_config; print(auth_config.fake_auth_token)"
  ```
- **file-gateway has NO bypass.** It always validates a real RS256 JWT
  against the tenant's live JWKS endpoint (`src/ms_identity_authentication.py`).
  There is no way to hit its authenticated `/files/...` route without a
  genuine Azure AD token.
- **web-app has no auth bypass.** Real OIDC via `oidc-client-ts`
  (`src/auth/oidcConfig.ts`, `src/config/authConfig.ts`,
  `src/auth/RequireAuth.tsx`). No mock provider, no env flag to skip login.
  A local FE run still logs in by itself as the consultancy's test user. So
  FE-driven flows are testable locally. QA still needs the user to log in.

## Local browser login (test user)

Use this procedure for every local web-app check in the Playwright MCP
browser. QA (`<QA_URL>`) keeps the manual user login.

Preconditions:

- web-app serves `https://localhost:5173`. This is the redirect URI
  registered on the consultancy-tenant app. Any other port fails with
  `AADSTS50011`.
- The MCP browser runs `--isolated`. Every new omp session starts logged out.

Steps:

1. Navigate to the base URL. Take a snapshot. If the page greets
   `Hello <test-user>`, stop: you are logged in. If it greets another user,
   fail with `signed in as another user`.
2. Click `Continue with <CLIENT> account`.
3. On `Pick an account`, click `Use another account`.
4. In the email textbox, call `browser_type` with
   `text: "LOCAL_TEST_USER_USERNAME"` and `submit: true`. Type the key name
   exactly. The MCP types the real value.
5. In the password textbox, call `browser_type` with
   `text: "LOCAL_TEST_USER_PASSWORD"` and `submit: true`.
6. On the code page, make sure `Don't ask again for 90 days` is ticked. It is
   ticked by default, so do not click it. If it is absent, skip it.
   Run `node .omp/playwright/totp.mjs` with bash. Use the session cwd (a task
   folder or the tasks root). Call `browser_type` with the printed 6 digits in
   the code textbox, then click `Verify`. If the page reports a wrong code, run
   the CLI once more and retry once.
7. On `Let's keep your account secure`, click `Not now`.
8. On `Stay signed in?`, click `Yes`.
9. Confirm the greeting `Hello <test-user>` and the avatar `<initials>`.

Failure rule: stop and report `auto-login failed: <AADSTS code or step name>`
when any of these happens:

- Page text holds `AADSTS<digits>`.
- The code is wrong a second time.
- The page matches none of the steps after one 3 s `browser_wait_for`.

Never ask the user to log in for a local run.

Rules:

- Never type a literal credential. Type only the two key names.
- Never read, grep, or cat the secrets file.
- A response shows `<secret>LOCAL_TEST_USER_USERNAME</secret>` where the email
  appears. This is expected.

Source of the Entra labels (`Use another account`, `Verify`, `Not now`,
`Stay signed in?`, `Don't ask again for 90 days`): the 2026-10-08 manual run
(`docs/local-test-user-login-findings.md`). The 2026-10-08 live run confirmed
`Stay signed in?` (buttons `No`, `Yes`) and the checkbox `Don't ask again for
90 days` (already ticked). In that run `Pick an account` and `Let's keep your
account secure` did not appear. Treat steps 3 and 7 as conditional.

## Env var prefix gotcha

`AgentConfig` (in `orchestrator/app/config.py`) uses
`env_prefix="AGENT_"` — overriding, e.g., the MCP URL requires
`AGENT_MCP_IMAGE_GENERATION_URL=...`, not the bare name. `AuthConfig` in the
same file has no prefix. Settings classes in the same app can have different
prefixes — check `SettingsConfigDict` per class before assuming an env var name.

## Verifying Word/Presentation generation (no dedicated response field)

The orchestrator's chat API (`PostMessageResponse`/`MessageResponse` in `app/schemas.py`)
only has a dedicated `generated_image_info` field — Word and PPTX results are
NOT structurally surfaced; you get whatever prose the LLM includes. For ground
truth, list the real Azure Blob container directly using the app's own
already-wired async client (don't hand-roll a new Blob SDK call):

```python
import asyncio
from src.config import get_settings
from src.clients.lifecycle import init_clients, close_clients, get_word_blob_container  # or get_presentations_container / get_blob_container

async def main():
    settings = get_settings()
    await init_clients(settings)
    container = get_word_blob_container()
    blobs = [(b.last_modified, b.name) async for b in container.list_blobs()]
    ...
    await close_clients()

asyncio.run(main())
```

Sort by `last_modified` descending — the newest blob is your request's output.
Its root path segment is the tagged user id (or `"anonymous"` fallback per
`media-mcp/src/utils/blob.py::build_blob_path`).

**Negative control:** always cross-check the same container's older entries —
genuine `anonymous/...` blobs sitting right below your new `<real-oid>/...`
blob in the same container prove the tagging is real and user-id-driven, not
coincidental.

## Director-level independent verification (no bash access)

The `read` tool can GET live `http://` URLs directly (health checks, JSON API
responses) without needing bash — useful when you're in a director role. It
fails on self-signed HTTPS (e.g. `web-app`'s local mkcert cert: "self
signed certificate in certificate chain") — for HTTPS local dev servers, rely
on a worker's `curl -k` output plus corroborating signals (process list,
framework startup log lines) instead.

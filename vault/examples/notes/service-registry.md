---
type: note
created: 2026-03-10
tags: [reference]
projects: ["[[projects/meter-api]]", "[[projects/web-app]]"]
topics: ["services", "local-setup"]
updated: 2026-03-10
---

## Summary
This note lists each service of the Acme Platform, its local port, and its start order. Start the API before the web app.

## Details
| Order | Project | Local port | Notes |
|---|---|---|---|
| 1 | [[projects/meter-api]] | 8000 | Check `GET /health` before you start the next service. |
| 2 | [[projects/web-app]] | 5173 | Reads the API base URL from an env var. |

- Before you start a service, check that the port is free. If another process owns the port, pick a different port. Do not stop the other process.
- Source of the run steps: [[tasks/update-readme-run-steps]].

# Index

This page is a catalog of the vault. It lists every hub page, grouped by type. Read this page first when you answer a query.

## Schema and log
- [[schema]] — the vault contract: folders, fields, and rules.
- [[log]] — the append-only event log.

## Orgs
- [[orgs/AcmeGrid]] — Acme Grid, a fictional power-grid operator and the primary client.
- [[orgs/Northwind]] — Northwind, the fictional consultancy that employs the user.
- [[orgs/Personal]] — personal context outside client work.

## Projects
- [[projects/meter-api]] — the backend API that stores and serves smart-meter readings.
- [[projects/web-app]] — the React and Vite front end for the Acme Platform.

## Tasks
- [[tasks/fix-meter-reading-rounding]] — Store each meter reading with its full three decimal places; round only on display.
- [[tasks/add-retry-to-export-job]] — Make the nightly export job retry when the file store is slow.
- [[tasks/update-readme-run-steps]] — Update the README run steps so a new engineer can start the API on the first try.

## Meetings
- [[meetings/2026-03-04-platform-standup]] — Platform standup (2026-03-04): a rounding defect, an export retry request, and a stale README.

## People
- [[people/taylor-techlead]] — technical lead, Acme Platform team.
- [[people/morgan-qatester]] — QA tester, Acme Platform team.
- [[people/casey-productowner]] — product owner, Acme Platform.
- [[people/jamie-author]] — vault owner, software engineer at Northwind.

## Decisions
- [[decisions/2026-03-03-store-readings-as-integers]] — (superseded) The API stored each reading as an integer number of hundredths.
- [[decisions/2026-03-09-store-readings-as-decimals]] — The API now stores each reading as a three-place fixed-point decimal and rounds only on display.

## Notes
- [[notes/service-registry]] — every service of the Acme Platform with its local port and start order.
- [[notes/2026-03-13-lint-report]] — lint report: 1 stale task, no other findings.

## Sources
- [[sources/2026-03-05-slack-reading-precision-thread]] — Slack thread that confirmed the rounding fix must keep three decimal places.
- [[sources/2026-03-06-vendor-meter-protocol-guide]] — Vendor guide on the meter payload, precision rules, and retry rules.

## Views
- [[views/tasks.base]] — the task board, grouped by status.
- [[views/meetings.base]] — the meeting log, sorted by date.
- [[views/decisions.base]] — the decision log, grouped by project.
- [[views/people.base]] — the people directory, grouped by org.
- [[views/projects.base]] — the project list, grouped by status.
- [[views/sources.base]] — the source log, sorted by date.

---
type: task
created: 2026-03-05
tags: [bug]
project: "[[projects/meter-api]]"
status: doing
priority: p2
started: 2026-03-05
ado_id: 12345
ado_state: "Active"
sprint: "Sprint 12"
due: 2026-03-13
completed: null
pr: null
branch: "task/fix-meter-reading-rounding"
---

## Goal
Store each meter reading with its full three decimal places. Round the value only when the API shows it.

## Notes
- Origin: [[meetings/2026-03-04-platform-standup]]. Owner: [[people/jamie-author|Jamie Author]]. Retest owner: [[people/morgan-qatester|Morgan Qatester]].
- The vendor guide says a receiver must not round before it stores the value. See [[sources/2026-03-06-vendor-meter-protocol-guide]].
- Design choice: [[decisions/2026-03-09-store-readings-as-decimals]].

## Debug log
- 2026-03-05: Reproduced on the dev environment. The stored value is 1235 (hundredths), not 12346 (thousandths).
- 2026-03-09: Changed the column to a decimal type. The migration passes on a copy of the dev data.

## Drift
Record differences between the vault state and the ADO state here.

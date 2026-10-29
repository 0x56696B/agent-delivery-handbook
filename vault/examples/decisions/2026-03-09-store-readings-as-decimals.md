---
type: decision
created: 2026-03-09
tags: []
date: 2026-03-09
project: "[[projects/meter-api]]"
status: accepted
supersedes: "[[decisions/2026-03-03-store-readings-as-integers]]"
---

## Decision
The API stores each meter reading as a fixed-point decimal with three decimal places. The API rounds a value only when it shows the value to a user.

## Context
The vendor guide says a receiver must not round before it stores a value. See [[sources/2026-03-06-vendor-meter-protocol-guide]]. The old integer choice lost the third decimal place. See [[tasks/fix-meter-reading-rounding]].

## Reasoning
A fixed-point decimal keeps the exact device value and still avoids float errors. [[people/taylor-techlead|Taylor Techlead]] accepted this option over a float column and over a string column.

## Consequences
Good: stored values match the device. Bad: the team must run a one-time migration on the readings table and update the API tests.

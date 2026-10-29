---
type: decision
created: 2026-03-03
tags: []
date: 2026-03-03
project: "[[projects/meter-api]]"
status: superseded
supersedes: null
---

## Decision
The API stores each meter reading as an integer number of hundredths.

## Context
The first schema needed a fast, simple column type. The team assumed two decimal places were enough.

## Reasoning
Integer columns are small and avoid float errors. Two decimal places matched the screen design.

## Consequences
Good: simple storage. Bad: the value loses its third decimal place. [[meetings/2026-03-04-platform-standup]] found this defect. [[decisions/2026-03-09-store-readings-as-decimals]] supersedes this decision.

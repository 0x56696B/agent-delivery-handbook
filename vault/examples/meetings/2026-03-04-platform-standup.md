---
type: meeting
created: 2026-03-05
tags: []
date: 2026-03-04
kind: standup
project: "[[projects/meter-api]]"
org: "[[orgs/AcmeGrid]]"
attendees: ["[[people/taylor-techlead]]", "[[people/morgan-qatester]]", "[[people/casey-productowner]]", "[[people/jamie-author]]"]
raw: "[[raw/2026-03-04-platform-standup]]"
---

## Summary
This was the daily standup of the Acme Platform team. The team found a rounding defect in [[projects/meter-api]], agreed to fix it first, and filed two smaller action items.

## Discussion
- [[people/morgan-qatester|Morgan Qatester]] reported that the readings page shows 12.35 for a device value of 12.346. The API rounds the value too early.
- [[people/taylor-techlead|Taylor Techlead]] linked the defect to the integer storage choice in [[decisions/2026-03-03-store-readings-as-integers]]. Taylor wants to review that choice.
- [[people/jamie-author|Jamie Author]] took the fix and the later README update.
- [[people/casey-productowner|Casey Productowner]] asked for a retry in the nightly export job. [[people/taylor-techlead|Taylor Techlead]] set priority p3 and moved it out of the current sprint.
- [[people/casey-productowner|Casey Productowner]] reported that the README run steps are out of date.

## Actions
- [[tasks/fix-meter-reading-rounding]] — owner [[people/jamie-author|Jamie Author]].
- [[tasks/add-retry-to-export-job]] — requested by [[people/casey-productowner|Casey Productowner]].
- [[tasks/update-readme-run-steps]] — owner [[people/jamie-author|Jamie Author]].

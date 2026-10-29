---
type: project
created: 2026-03-02
tags: [backend]
org: "[[orgs/AcmeGrid]]"
repo: "https://dev.azure.com/acme-grid/Acme%20Platform/_git/meter-api"
repo_path: "~/work/acme-platform/meter-api"
ado_project: "Acme Platform"
ado_repo: "meter-api"
default_branch: "main"
ado_states:
  inbox: "New"
  todo: "Ready for Dev"
  doing: "Active"
  review: "In Review"
  done: "Closed"
status: active
summary: "The backend API that stores and serves smart-meter readings for the Acme Platform."
---

## Overview
This repo holds the meter-readings API. [[projects/web-app]] calls it.

## Links
- Meeting: [[meetings/2026-03-04-platform-standup]]
- Task: [[tasks/fix-meter-reading-rounding]]
- Task: [[tasks/add-retry-to-export-job]]
- Task: [[tasks/update-readme-run-steps]]
- Decision: [[decisions/2026-03-03-store-readings-as-integers]] (superseded)
- Decision: [[decisions/2026-03-09-store-readings-as-decimals]]
- Source: [[sources/2026-03-05-slack-reading-precision-thread]]
- Source: [[sources/2026-03-06-vendor-meter-protocol-guide]]
- Note: [[notes/service-registry]]

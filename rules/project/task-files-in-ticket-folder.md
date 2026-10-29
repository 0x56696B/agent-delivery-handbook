---
name: task-files-in-ticket-folder
description: "Never write task-related scratch files (commit messages, notes, etc.) outside the ticket's task folder; use ./<ticket-folder>/... instead of /tmp"
condition: "/tmp/[^\"']*\\.(txt|md|json|patch|diff)"
scope: ["tool:write(/tmp/*)", "tool:bash(*)"]
---

Never create workflow artifacts (commit messages, notes, plans, etc.) under `/tmp`. All files for the current ticket MUST live inside the ticket's task folder, e.g. `./<ticket-folder>/plan/` for design docs, or another clearly named subfolder for commit messages. Write commit message files with `write` into the ticket folder (e.g. `<ticket-folder>/commit-msg.txt`), never `/tmp/commit-msg-*.txt`.

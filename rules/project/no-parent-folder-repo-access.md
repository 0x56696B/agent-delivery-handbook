---
name: no-parent-folder-repo-access
description: "Never touch the bare repos or any path above the tasks folder; use the tasks folder or a synced main folder inside it"
alwaysApply: true
---

Do not touch anything in the parent of `~/work/<PROJECT>/tasks`. This includes the `~/work/<PROJECT>/*-bare` repos and any other path under `~/work/<PROJECT>/` outside `tasks/`. Do not read, search, grep, glob, or run git there.

If you need something, search inside the current tasks folder. Use the task-folder repo symlinks and run `git -C <task-folder>/<repo>`.

If you need code from `main`, do not go to the parent. Use one dedicated folder named `main` inside the tasks folder. It MUST hold the same structure as the other task folders: one repo symlink per worktree, each synced with `main`. If that folder does not exist yet, tell the user and ask to create it with the setup script. Do not fall back to the bare repos.

The extension `.omp/extensions/no-parent-folder-guard.ts` enforces this rule. It blocks the tool call before it runs and checks the path text only, not symlink targets.

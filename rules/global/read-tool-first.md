---
name: read-tool-first
description: "Use the read tool for every known file, file range, directory listing, and internal URL; never bash ls/cat/sed or a single-file grep"
alwaysApply: true
---

# Read with the read tool

When you know the path, use `read`. Do this from the first tool call of the session.

`read`, `grep`, and `glob` are tools. Call them as tools. They are not shell commands: never type them inside `bash`.

- File content: `read <path>`. Do not use `cat`, `head`, `tail`, `less`, `nl`, `cat -n`, `sed -n`, or `awk 'NR==...'`.
- Part of a file: put the range in the path, for example `read <path>:50-120`. `read` shows line numbers. Do not pipe to `sed -n` or `head`.
- Directory contents: `read <dir>`. Do not use `ls`, `ls -la`, `tree`, or `find <dir>`.
- One known file: `read` it. Do not `grep` a file that you can read. Use `grep` to find matches across many files, or in one file that is too large to read.
- File names that match a pattern: `glob`. Do not use `ls dir/*.ext` or `find -name`.
- Several known files: send several `read` calls in one turn. Do not chain `cat a; cat b` in one bash call.
- Internal URLs (`skill://`, `rule://`, `vault://`, `omp://`, `memory://`, `artifact://`, `local://`): use `read`. Bash cannot open them.
- Use `bash` only for real programs: git, builds, tests, package managers, `lsof`, project scripts, `readlink` for a symlink target.
- A file at another git ref: run `git show <ref>:<path>` alone. Do not pipe it to `cat -n` or `sed -n`. If the output is long, `read` the `artifact://` link with a line range.

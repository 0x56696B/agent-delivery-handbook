---
name: no-orphan-processes-after-use
description: "Stop every service or process you start before yielding, and never leave one running as a handoff"
condition: ["(?i)(still running|left running|service left running|keeps? running|remains? running)", "(?i)(run|stop|kill)[^\\n]{0,40}omp ps stop[^\\n]{0,60}(in your (own )?terminal|yourself)", "(?i)(user|you) (must|should|need to|can) (stop|kill)[^\\n]{0,60}(service|process|port)"]
question: "Does the reply say a process or service that this session started is still running, or ask the user to stop it, instead of confirming it was stopped and the port is free?"
scope: "text"
---

Clean up every process you start before you yield. Do not leave a service, dev server, or background job running, and do not hand the stop to the user.

- Before you start a service, plan its stop. Start it as a named service you own, and keep that name.
- When the check is done, stop it through the same tool that started it (`services` `action: stop` for the 5 local services). Do this in the same turn.
- A `process-ownership-guard:` block is final. Do not work around it. If it blocks a stop of a process you started, report the block at once and ask the user to stop it. Never use `proc://.../kill` or another route to get past it.
- Prefer a start path that the session owns, so the guard does not classify it as foreign. Do not start a second instance on a new name to avoid stopping the first.
- After each stop, run `lsof -nP -iTCP:<port> -sTCP:LISTEN`. Check child, reloader, and helper PIDs, not only the parent. Report the literal result.
- Remove scratch worktrees, temp files, and seeded test data before you finish.
- In the final report, state that each process is stopped and each port is free. If one is not, say which one and why. Do not call the work done while a process runs.

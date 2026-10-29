---
name: services-via-services-tool
description: "Start local services only through the services tool, never with a direct hub or named bash start unless the user approved it"
condition: "(?=[\\s\\S]*(\"op\"\\s*:\\s*\"start\"|\"name\"\\s*:\\s*\"))(?=[\\s\\S]*(uvicorn|\\bvite\\b|python -m app|--strictPort|\"ENV\"\\s*:\\s*\"local\"))"
scope: "tool:hub, tool:bash"
---

Start, stop, and inspect the 5 local services with the `services` tool (a custom harness tool that starts and stops them). Do not start one with `hub` `start` or a named `bash` call. Do not dispatch a subagent to start one.

- Call `services` from the main agent. A service that a subagent starts stops when that subagent ends.
- One `start` call takes a service list or `"all"`. The tool picks ports, wires siblings, runs setup, and checks health. Pass `ports`, `debug_ports`, `debug`, `repo_paths`, and `env` only when you need them.
- A direct `hub` or named `bash` start of a service needs the user's explicit approval in this conversation. If the tool cannot take a setting you need, say so and ask.
- Read logs with `action: logs`, or `read` the `log_file` path in the result. The services do not show in `proc://` or `omp ps`. Stop each service with `action: stop` before you yield, and report the `port_free` result.
- For a check that spans repos, still prove the request chain with real requests on both sides of each hop.

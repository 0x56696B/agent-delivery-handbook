---
description: "Configure which extra tools the vibe mode director keeps (vibeExtraTools config key, vibe-extra-tools.ts extension). Read when a tool is missing in /vibe mode or when adding a tool to a project's vibe setup."
---

# Vibe extra tools

Vibe mode (`/vibe`) cuts the director to `read`, optional `todo`, and the five `vibe_*` tools.
omp hardcodes this list (`#enterVibeMode` in `interactive-mode.ts`, omp 17.4.0). No setting changes it.
The global extension `~/.omp/agent/extensions/vibe-extra-tools.ts` adds tools back.

## Configure

Add a `vibeExtraTools` list of exact tool names to a config file:

```yaml
vibeExtraTools:
  - services
```

- Project: `<project>/.omp/config.yml`. Applies to that project only.
- Global: `~/.omp/agent/config.yml`. Applies to every project.
- The two lists are unioned. A project list adds to the global list. It never replaces it.
- The key is not an omp setting. omp carries and ignores unknown keys. Only the extension reads it.
- Names must be exact registered tool names. Use `getAllTools`-style names, for example
  `services` or `mcp__slack_conversations_history`. A name that is not registered is skipped without an error.
- The tasks project lists `services` in `~/work/<PROJECT>/tasks/.omp/config.yml`.

## When it applies

- The extension hooks `before_agent_start`. No event fires on vibe entry, so it checks on every prompt.
- It acts only when `vibe_spawn` is active, so normal sessions are untouched.
- It reads the config on every prompt. Edit the config and the next prompt picks it up. No restart.
- A new or changed extension file loads only at omp startup. Restart omp after editing `vibe-extra-tools.ts`.
- It adds each missing tool with `setActiveTools([...active, ...missing])`, then sends a hidden note
  (`customType: vibe-extra-tools`) that names the tools. The note tells the director it may call them,
  despite the vibe prompt rule "NEVER run yourself".
- Exiting vibe mode restores the pre-vibe tool set. A tool that was active before vibe mode stays active.

## Limits

- The system prompt of the first vibe turn is built before the hook runs. It may not list the added tools.
  The hidden note in the same turn names them. If the director refuses the tool on the first turn,
  the extension needs a `systemPrompt` addition: return `[...event.systemPrompt, note]`, never `[note]` alone.
- Workers do not get these tools through this key. It affects the director only.
- A config parse error shows one warning in the TUI. Vibe mode keeps working without the extra tools.

## Check that it works

1. Restart omp after any change to the extension file.
2. Run `/vibe call <tool> with a harmless action and report the result`.
3. Pass: a tool call to `<tool>` shows in the transcript and returns a result.
4. Evidence in the parent session JSONL (`~/.omp/agent/sessions/`): a `custom` entry with
   `customType` `vibe-extra-tools`, and an assistant tool call to `<tool>`. Look in the director's file, not a worker's.
5. Negative control: remove the name from `vibeExtraTools`, then send a prompt in vibe mode. The tool is gone from the director.
   A tool already added in that vibe session stays until you exit vibe mode.

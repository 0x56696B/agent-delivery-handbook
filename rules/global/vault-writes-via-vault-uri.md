---
name: vault-writes-via-vault-uri
description: "Vault pages must be written and edited through vault:// URIs, never the raw wiki filesystem path"
condition: ["personal[/]wiki[/](notes|log|index|tasks|projects|orgs|meetings|people|decisions|sources|views|templates)", "personal\\\\[/]wiki"]
scope: ["tool:write", "tool:edit"]
---

Stop. Address vault pages by their `vault://` URI, never by a raw filesystem path.

- Write: `vault://wiki/notes/<slug>.md`, not `<VAULT_ROOT>/notes/<slug>.md`.
- Edit: the section header must read `[vault://wiki/<path>#TAG]`, and the tag must come from a `vault://` read of that same page.
- Read the same way, so the snapshot tag belongs to the vault URI.

Before any vault write, read `vault://wiki/schema.md` and obey it:

- Put the file in the folder for its page type.
- Follow the naming rule for that type. A dated note needs the `YYYY-MM-DD-` prefix.
- Set every required frontmatter field for that type, with allowed values only.
- `raw/` is immutable. `log.md` is append-only: re-read the tail, then append after the final entry. Never edit a past entry, and never reuse a line number from an old read.

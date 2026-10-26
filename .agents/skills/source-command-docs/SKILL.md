---
name: "source-command-docs"
description: "Migrated source command `docs`"
---

# source-command-docs

Use this skill when the user asks to run the migrated source command `docs`.

## Command Template

# /docs

Documentation mode.

1. Call `neuron_context` with what should be documented
2. Open only the returned paths; verify against source
3. Prefer updating existing project docs over inventing a wiki
4. Output technical / architecture docs and guides grounded in those files

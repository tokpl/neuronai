---
name: "source-command-neuron-review"
description: "Migrated source command `neuron-review`"
---

# source-command-neuron-review

Use this skill when the user asks to run the migrated source command `neuron-review`.

## Command Template

# /neuron-review

Review architecture impact of the proposed or completed change.

1. Call `neuron_context` with a short change description (mode `deep` if multi-module)
2. Prefer returned impact / dependency hints and connected files
3. Report risks and “do not” warnings
4. Suggest whether anything should be saved via `neuron_after_task`

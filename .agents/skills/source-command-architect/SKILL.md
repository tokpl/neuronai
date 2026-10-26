---
name: "source-command-architect"
description: "Migrated source command `architect`"
---

# source-command-architect

Use this skill when the user asks to run the migrated source command `architect`.

## Command Template

# /architect

Design systems with Neuron project context.

1. Call `neuron_context` with the design question (prefer mode `deep`)
2. Prefer returned modules, decisions and rules as the evidence base
3. Return Summary / Evidence / Findings / Recommendations / Confidence
4. Do not auto-generate large code changes

If Neuron context is empty, say so and explore only enough to answer.

# Cursor integration package

Canonical templates for Neuron ↔ Cursor live in `packages/cursor-integration/templates/` and are mirrored here for discoverability.

```text
integrations/cursor/
  mcp/          → .cursor/mcp.json shape
  rules/        → .cursor/rules/neuron-memory.mdc
  skills/       → .cursor/skills/neuron-memory/SKILL.md
  commands/     → .cursor/commands/*.md  (/neuron-*)
  templates/    → project brain markdown seeds + workflow
```

## Install into a project

```bash
neuron init cursor
# or
neuron cursor setup
neuron cursor doctor
```

## Design

- MCP handlers stay thin; templates only teach the agent *when* to call tools
- Context Budget Manager caps tokens/items (see `@neuron-ai-memory/cursor-integration`)
- Project brain files under `.neuron/` are git-friendly summaries

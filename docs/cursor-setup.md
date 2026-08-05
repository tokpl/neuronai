# Cursor setup

Prefer the full guide: [cursor-integration.md](./cursor-integration.md).

## Fast path

```bash
neuron init cursor
neuron cursor doctor
```

Writes:

- `.cursor/mcp.json` — `{ "command": "neuron", "args": ["mcp"] }` (validated)
- `.cursor/rules/neuron-memory.mdc` — BEFORE / DURING / AFTER
- `.cursor/skills/neuron-memory/SKILL.md`
- `.cursor/commands/neuron-*.md`
- `.neuron/{project.json,architecture.md,decisions.md,patterns.md,warnings.md}`

## Manual MCP

```json
{
  "mcpServers": {
    "neuron": {
      "command": "neuron",
      "args": ["mcp"],
      "env": {
        "NEURON_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

## Try it

- “Analyze this project using Neuron”
- “/neuron-context” then describe your feature
- “Remember this architecture decision…”

# Cursor integration

Neuron’s primary host is **Cursor**. This doc covers the full DX stack:

**Cursor + Neuron MCP + Neuron Rules + Neuron Skills + Project Brain**

## Use Neuron with Cursor in 5 minutes

```bash
pnpm install && pnpm build          # from the Neuron monorepo, or npm i -g neuron-ai-memory later
cd your-app
neuron init cursor
neuron cursor doctor
```

1. Open `your-app` in Cursor  
2. Enable MCP server **neuron** (Settings → MCP)  
3. In chat: *“Prepare adding notifications using Neuron”*  
4. Expect tools: `neuron_prepare_task` / `neuron_get_context`  
5. After coding: *“Should Neuron remember this?”*

## What gets generated

| Path | Purpose |
|------|---------|
| `.cursor/mcp.json` | `neuron mcp` entry |
| `.cursor/rules/neuron-memory.mdc` | BEFORE / DURING / AFTER policy |
| `.cursor/skills/neuron-memory/SKILL.md` | Tool map + workflow |
| `.cursor/commands/neuron-*.md` | `/neuron-context`, `/neuron-plan`, … |
| `.neuron/project.json` | Project id + stack |
| `.neuron/architecture.md` | Architecture notes |
| `.neuron/decisions.md` | Decisions export |
| `.neuron/patterns.md` | Patterns export |
| `.neuron/warnings.md` | Mistakes / do-nots |

## Commands

| CLI | Effect |
|-----|--------|
| `neuron init cursor` | Full bootstrap |
| `neuron cursor setup` | MCP + rules + skills + commands |
| `neuron cursor doctor` | Validate wiring |
| `neuron cursor init` | Alias of `init cursor` |

## MCP config (validated)

```json
{
  "mcpServers": {
    "neuron": {
      "command": "neuron",
      "args": ["mcp"],
      "env": { "NEURON_CWD": "/absolute/path/to/project" }
    }
  }
}
```

See also [cursor-workflow.md](./cursor-workflow.md) and [cursor-troubleshooting.md](./cursor-troubleshooting.md).

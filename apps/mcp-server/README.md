# @neuronai/mcp-server

MCP server for NeuronAI project memory. Local-first, stdio transport, no network calls.

## Tools

| Tool | Purpose |
| --- | --- |
| `neuron_context` | Ranked, compressed project knowledge for a coding task |
| `neuron_search` | Keyword search over memories |
| `neuron_remember` | Store a decision, pattern, warning or fact |
| `neuron_update` | Change a memory (versioned) |
| `neuron_after_task` | Propose what is worth remembering after coding |
| `neuron_resolve_suggestion` | Apply the user's Yes / Edit / No answer |
| `neuron_scan` | Rebuild the project brain from the codebase |

Also exposes the `neuron://project/brain` resource and the `neuron_before_coding` /
`neuron_after_coding` prompts.

## Run

```bash
pnpm dev:mcp
# or, from an installed CLI
neuron mcp
```

Cursor invokes this automatically once `.cursor/mcp.json` exists — `neuron init` writes it.

stdout is reserved for JSON-RPC; all logging goes to stderr.

Full reference: [docs/mcp.md](../../docs/mcp.md).

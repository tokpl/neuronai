# MCP Server

Neuron’s primary interface for AI coding agents (Cursor, Claude Code, and any MCP host).

## Architecture

```text
MCP Tool / Resource / Prompt
        │
        ▼
   handlers/ (application)
        │
        ▼
 Memory Engine + AI Intelligence
        │
        ▼
 Storage (in-memory local runtime; Postgres adapters available)
```

The MCP layer contains **no domain logic** — only validation, auth, and wiring.

## Tools

| Tool | Purpose |
|------|---------|
| `neuron_get_context` | Task-scoped context pack |
| `neuron_search_memory` | Hybrid semantic search |
| `neuron_save_decision` | Architecture decision ADR |
| `neuron_store_memory` | Knowledge / pattern / mistake / … |
| `neuron_review_memory` | “Should we remember this?” |
| `neuron_update_memory` | Versioned update |
| `neuron_project_summary` | Stack + architecture overview |
| `neuron_health` | Liveness |

## Resources

- `neuron://project/context`
- `neuron://project/architecture`
- `neuron://project/decisions`
- `neuron://project/patterns`
- `neuron://project/mistakes`

## Prompts

- `neuron_analyze_project`
- `neuron_before_coding`
- `neuron_after_coding`
- `neuron_architecture_review`

## Auth

- **local** (default): no API key
- **cloud**: `NEURON_API_KEY` via `AuthProvider`

## Run locally

```bash
pnpm install
pnpm build
pnpm dev:mcp
# or
pnpm neuron mcp
```

See also [cursor-setup.md](./cursor-setup.md) and [mcp-tools-reference.md](./mcp-tools-reference.md).

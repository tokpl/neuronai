# Architecture guide (contributors)

## Layers

```text
apps/cli, apps/mcp-server
        ↓
agent-intelligence / agent-workflow / knowledge-graph
        ↓
memory-engine / ai-memory
        ↓
storage / ops / security / observability / types
```

## Rules

- MCP handlers stay thin — call packages, don’t embed domain logic
- No raw chat storage
- Versioned memory updates
- Local-first; cloud features behind stubs + consent

## Packages of interest

| Package | Role | MVP |
|---------|------|-----|
| `memory-engine` | DDD core | P0 |
| `ai-memory` | extract / score / search | P0 |
| `knowledge-graph` | project structure | P0 |
| `project-scanner` | brain bootstrap | P0 |
| `retrieval-engine` | budgeted context | P0 |
| `cursor-integration` | Cursor MCP templates | P0 |
| `agent-intelligence` | prepare / review / plan | P0 (thin) |
| `security` | ACL / redaction / consent | P0 |
| `ops` | backup / maintain | P1 |
| Others | See [mvp.md](./mvp.md) | P1–P3 / experimental |

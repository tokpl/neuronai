# How Neuron works

```text
Developer
   │
   ▼
neuron init  →  .neuron/ (FileStorageProvider)
   │
   ▼
Cursor MCP (12 tools)
   │
   ▼
Neuron Core (memory + retrieval + scan)
   │
   ▼
Ranked project context → Cursor model answers
```

## Principles

1. **Local-first** — knowledge lives in `.neuron/` on disk
2. **Git is Team Brain** — version `*.json` brain files; ignore cache/runtime
3. **Neuron delivers knowledge** — Cursor’s model writes the answer
4. **Small surface** — 12 MCP tools, not 100+

## Storage

`FileStorageProvider` is the only MVP backend.

- Versioned: `config.json`, `brain.json`, `knowledge.json`, `decisions.json`, `rules.json`, `graph.json`
- Ephemeral: `cache/`, `runtime/`, `indexes/`, `logs/`

Postgres / SQLite are **future / experimental** (see `future/`).

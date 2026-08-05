# Continuous Project Intelligence

Neuron stays aware of project evolution **after** `neuron init` — locally, without uploading data.

## Continuous workflow

```text
Filesystem / Git events
        │
        ▼
 ProjectEventBus
        │
        ├── FileChangeAnalyzer
        ├── GitIntelligence
        ├── ArchitectureDriftDetector
        └── MemorySuggestionEngine
                │
                ▼
 Pending memories (approval required)
 Project timeline · Live health
```

Package: `@neuron-ai-memory/project-intelligence`  
(Static graph analysis remains in `@neuron-ai-memory/knowledge-graph` → `ProjectIntelligenceEngine`.)

## Cursor moments

| Moment | Use |
|--------|-----|
| Before coding | `neuron_project_health_live` / recent changes |
| Before refactor | `neuron_detect_drift` + risks |
| After coding | `neuron_pending_memories` |

## MCP

- `neuron_project_changes`
- `neuron_detect_drift`
- `neuron_pending_memories`
- `neuron_project_health_live`

## CLI

`neuron watch` — local watch mode (see [watch-mode.md](./watch-mode.md))

Also: [architecture-drift.md](./architecture-drift.md)

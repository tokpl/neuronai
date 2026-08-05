# Agent workflow

Neuron as an intelligent observer of the development process — not a chat logger.

## Principles

- Detect moments when valuable engineering knowledge appears
- Prefer **suggestions** over silent writes (default privacy: `suggest`)
- Never dump private conversations into memory
- Quality gate before any persist (duplicates, low confidence, conflicts)

## Lifecycle

```text
START TASK
    │
    ▼
neuron_start_task / neuron_get_context
    │
    ▼
Agent coding
    │  (optional: neuron_ingest_event)
    ▼
neuron_after_task / neuron_suggest_from_changes
    │
    ▼
MemorySuggestionEngine + WorkflowRules + QualityChecker
    │
    ▼
Prompt: Save | Edit | Ignore
    │
    ▼
neuron_save_decision / neuron_store_memory
```

### Before coding

Agent calls `neuron_start_task` (or `neuron_get_context`). Neuron prepares relevant decisions, warnings, and architecture notes.

### During coding

Optional events: `CodeChanged`, `FileCreated`, `FileDeleted`, … via `neuron_ingest_event` or hooks.

### After coding

Agent (or CLI `neuron suggest`) passes a diff / commit message. Neuron analyzes impact and may ask to save a decision.

## Event architecture

In-process `EventBus` (no external broker yet).

| Event | Meaning |
|-------|---------|
| `ProjectOpened` | Workspace detected |
| `AgentStartedTask` | Agent begins work |
| `CodeChanged` | Diff / file edits |
| `FileCreated` / `FileDeleted` | Path-level changes |
| `GitCommitted` | Commit observed |
| `PullRequestCreated` | PR signal |
| `ArchitectureChanged` | Explicit architecture signal |
| `DocumentationChanged` | Docs edited |
| `TaskCompleted` | Agent finished task |

Each event: `id`, `type`, `projectId`, `source`, `payload`, `timestamp`.

## Rules (WorkflowRules)

1. **>5 files in one module** → suggest architecture review  
2. Commit keywords `refactor` / `migration` / `architecture` / `rewrite` → boost importance  
3. Dependency change (`package.json`, lockfiles, …) → suggest dependency decision  
4. Database schema / migration → **always** suggest  

## Privacy modes

Configured in `.neuron/config.json`:

```json
{
  "privacy": { "mode": "suggest" }
}
```

| Mode | Behavior |
|------|----------|
| `manual` | No workflow suggestions; explicit MCP tools only |
| `suggest` | Default — propose Save/Edit/Ignore |
| `automatic` | Persist high-confidence suggestions that pass quality checks |

Env override: `NEURON_PRIVACY_MODE`.

## Hooks (extension points)

Interfaces ready for future Cursor / Claude / Git / IDE plugins:

- `BeforeTaskHook` / `AfterTaskHook`
- `BeforeCommitHook` / `AfterCommitHook`

## Package

`packages/agent-workflow` — events, analyzers, suggestion engine, privacy, orchestrator.

CLI: `neuron suggest` / `neuron suggest --commit`

MCP: `neuron_start_task`, `neuron_ingest_event`, `neuron_after_task`, `neuron_suggest_from_changes`

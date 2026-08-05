# Module system

## NeuronModule

Each module declares:

| Field | Meaning |
|-------|---------|
| `name` | Closed enum (`memory`, `graph`, …) |
| `version` | Semantic version |
| `dependencies` | Other module names |
| `capabilities` | What the module exposes |
| `initialize` / `shutdown` / `healthCheck` | Lifecycle |

## Core modules

| Module | Package |
|--------|---------|
| MemoryModule | `@neuron-ai-memory/memory-engine` |
| GraphModule | `@neuron-ai-memory/knowledge-graph` |
| RetrievalModule | `@neuron-ai-memory/retrieval-engine` |
| DecisionModule | `@neuron-ai-memory/decision-engine` |
| AIProviderModule | `@neuron-ai-memory/ai-runtime` |
| SecurityModule | `@neuron-ai-memory/security` |
| PerformanceModule | `@neuron-ai-memory/performance-intelligence` |
| DocumentationModule | `@neuron-ai-memory/documentation-intelligence` |
| EvaluationModule | `@neuron-ai-memory/evaluation-engine` |
| WorkflowModule | `@neuron-ai-memory/workflow-intelligence` |

## Lifecycle

```text
load → initialize → validate → run → shutdown
```

Dependencies initialize first (topological order).

## Events

`MemoryCreated` · `MemoryUpdated` · `GraphChanged` · `DecisionCreated` · `AnalysisCompleted` · `ProjectScanned`

## Forbidden

- Public plugin marketplace
- User-created plugins
- Dynamic `import()` of untrusted code
- Third-party module registration

See [core-framework.md](./core-framework.md).

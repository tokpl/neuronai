# Retrieval Engine

Neuron’s answer to **context overload**: deliver the most valuable project knowledge for a specific task — not everything the store knows.

## Pipeline

```text
User Task
  → Query Understanding
  → Multi Source Retrieval
  → Ranking (+ optional Reranker)
  → Conflict Filtering
  → Compression
  → Context Assembly
  → Agent Context
```

Package: `@neuron-ai-memory/retrieval-engine`

## Sources

| Retriever | Role |
|-----------|------|
| MemoryRetriever | Active memories (hybrid keyword relevance) |
| DecisionRetriever | Architecture decisions |
| TimeAwareRetriever | Temporal boost / demote superseded stack decisions |
| ConstitutionRetriever | Active Project Constitution rules |
| KnowledgeGraphRetriever | Module / area names |
| CodeRetriever | Matching file/symbol names |
| GitHistoryRetriever | Commit subjects (when provided) |
| DocumentationRetriever | Doc snippets (when provided) |
| StyleRetriever | Naming / library preferences |

## MCP / CLI

- `neuron_deep_search`
- `neuron_optimize_context`
- `neuron_explain_context`
- `neuron_architecture_context`
- CLI: `neuron optimize-context "Add payment refunds" --explain`

See [ranking.md](./ranking.md) and [context-optimization.md](./context-optimization.md).

# Ranking

## Scores

Each hit receives:

| Score | Meaning |
|-------|---------|
| relevanceScore | Keyword / domain overlap with the task |
| importanceScore | Memory importance (or source prior) |
| confidenceScore | Confidence of the underlying fact |
| distanceScore | Source authority (constitution > decision > memory > git) |
| freshnessScore | Temporal awareness (newer decisions win) |
| finalScore | Weighted hybrid |

## Default weights

```text
final =
  0.28·relevance +
  0.20·importance +
  0.12·confidence +
  0.10·distance +
  0.12·freshness +
  0.18·taskRelevance
```

Weights are configurable and can be nudged via the retrieval learning loop (feedback), without training a neural model.

## Rerankers

- `SimpleReranker` — local token bonus (default)
- `LLMReranker` — inject your own async scorer
- `CrossEncoderReranker` — inject a scoring function

## Conflicts

If “Use REST” and “Migrate to GraphQL” both match, Neuron surfaces a **conflict** and keeps the newer decision as truth.

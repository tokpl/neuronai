# Evaluation Engine

Neuron answers: **Was my answer good?** and **What should we improve?**

Package: `@neuron-ai-memory/evaluation-engine`  
Store: `.neuron/evaluation.json` (metrics only — no full conversations)

## Architecture

```text
packages/evaluation-engine/src/
  benchmarks/   Neuron Benchmark Suite + .neuron/benchmarks/
  metrics/      QualityMetrics
  datasets/     sample cases
  scoring/      answers · retrieval · memory quality
  feedback/     Helpful / Wrong / Missing context / Needs improvement
  analysis/     hallucinations · models · regressions · improvements · decisions
  facade/       EvaluationEngine
```

## QualityMetrics

accuracy · relevance · completeness · confidence · consistency → overall

## MCP

- `neuron_quality_report`
- `neuron_evaluate_answer`
- `neuron_memory_quality`
- `neuron_benchmark`

See [quality-system.md](./quality-system.md) and [benchmarks.md](./benchmarks.md).

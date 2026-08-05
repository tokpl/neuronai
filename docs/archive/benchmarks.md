# Benchmarks

Neuron’s evaluation platform measures whether the **memory / quality layer** improves agent work — not whether an LLM can generate code, and never trains models.

## Architecture

```text
Builtin suite + .neuron/benchmarks/*.json
        │
        ▼
 EvaluationEngine.runBenchmark / BenchmarkRunner (legacy)
        │
        ▼
 .neuron/evaluation.json + optional benchmark-report.md
```

Packages:

- `@neuron-ai-memory/evaluation-engine` — Etap 34 quality suite
- `@neuron-ai-memory/benchmark` — WITH/WITHOUT Neuron memory-layer suite

## Categories

Architecture · Debug · Security · Performance · Documentation

## Project-specific

```text
.neuron/benchmarks/
  auth-tests.json
  payment-tests.json
```

Example case:

```json
{
  "id": "auth-tests",
  "category": "architecture",
  "question": "How authentication works?",
  "expectedKeywords": ["auth", "session", "jwt"],
  "unexpectedKeywords": ["css"]
}
```

## CLI (legacy memory suite)

```bash
neuron benchmark
neuron benchmark report
neuron benchmark retrieval
```

## MCP

- `neuron_benchmark` — run quality suite → `evaluation.json`
- `neuron_benchmark_status` — legacy readiness / report excerpt

See [evaluation-engine.md](./evaluation-engine.md) and [quality-system.md](./quality-system.md).

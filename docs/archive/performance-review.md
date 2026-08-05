# Performance review

## Workflow

```text
"Optimize this module"
        │
        ▼
 neuron_performance_context
   → patterns, bottlenecks, risks, prior optimizations
        │
        ▼
 neuron_database_review / neuron_scalability_check
        │
        ▼
 neuron_performance_review → performance-report.md
```

## Benchmark integration

Record before/after optimization snapshots locally; pair with the Benchmark Suite for WITH/WITHOUT Neuron evaluations — still advisory, not production APM.

# Memory Governance

Neuron keeps the project brain from becoming a junk drawer — without destroying history.

```text
Memories + code signals
        │
        ▼
 lifecycle · decay · importance · similarity
 conflicts · validation · archive proposals
        │
        ▼
 ReviewQueue + CleanupEngine + memory-health.md
        │
        ▼
 Developer approval (audited)
```

## Hard rules

- **Never** permanently delete memories
- **Never** hide knowledge changes — audit every scan/cleanup plan
- **Never** auto-archive important architecture decisions without approval
- Scheduled maintenance default **OFF**

## MCP

- `neuron_memory_health`
- `neuron_memory_conflicts`
- `neuron_memory_review`
- `neuron_memory_cleanup`
- (aliases) `neuron_review_queue`, `neuron_cleanup_suggestions`

See [memory-lifecycle.md](./memory-lifecycle.md), [memory-quality.md](./memory-quality.md), [conflict-resolution.md](./conflict-resolution.md).

# Performance

## Retrieval scales

Default probes: **100 · 1 000 · 10 000 · 100 000** memories.

Measured:

- search / assembly latency
- ranking quality (precision proxy)
- emitted token size vs budget

Use `neuron benchmark --fast` to skip 100 000 in CI.

## Token optimization example

| | Tokens |
|-|--------|
| Raw project context | ~15 000 |
| Neuron optimized | ~3 500 |
| Information preserved | high recall relative to raw |

Exact numbers come from the latest `benchmark-report.md`.

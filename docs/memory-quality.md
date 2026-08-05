# Memory quality & maintenance

Neuron keeps knowledge healthy without destroying it.

## Cleanup workflow

```text
scan (health + decay + conflicts + duplicates)
        ↓
ReviewQueue / CleanupEngine proposals
        ↓
Developer approval
        ↓
apply via memory-engine (archive/supersede/merge)
        ↓
audit log + .neuron/memory-health.md
```

Operations: **merge · archive · invalidate · recalculate · review**  
Never: **permanent delete**

## Scheduled maintenance

Default **OFF**. Cadence `daily` | `weekly` | `manual` is planning-only until explicitly enabled.

## MCP

- `neuron_memory_health` — report + writes `.neuron/memory-health.md`
- `neuron_memory_conflicts`
- `neuron_memory_review`
- `neuron_memory_cleanup`

## Cursor

Before answering, prefer `neuron_memory_health` / review queue so context is not outdated.

See [memory-lifecycle.md](./memory-lifecycle.md).

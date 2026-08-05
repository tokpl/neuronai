# Observability (internal)

Neuron’s observability package is an **internal debugger**, not a cloud analytics platform.

It answers: *What did Neuron do and why?*

## Package layout

```
packages/observability/src/
  tracing/     NeuronTrace, ReasoningTrace, MemoryUsage, AIModelTrace, TraceStore
  logging/     Logger re-exports
  metrics/     NeuronMetrics (+ in-process counters)
  debug/       RetrievalDebugger, DecisionDebugger, NeuronErrorAnalyzer
  events/      Local ObservabilityEventBus
  reports/     neuron-report.md generator
  facade/      ObservabilityEngine
```

## Storage

- File: `.neuron/traces.json` (local JSON)
- Report: `.neuron/neuron-report.md`
- **Never** stores secrets, full source dumps, or sensitive paths (filtered before persist)
- Retention: `disable` | `temporary` (default, TTL hours) | `persistent`

## Debug mode

Default: **OFF**

```bash
neuron debug --on
neuron debug --off
neuron debug --retention temporary
neuron debug --on --demo
```

When ON, `debugSessionSummary()` includes verbose reasoning, retrieval details, and module execution.

## MCP tools

| Tool | Purpose |
|------|---------|
| `neuron_trace_last` | Last operation |
| `neuron_explain_reasoning` | Why (reasoning path) |
| `neuron_trace_context` | Context / memories used |
| `neuron_performance_metrics` | Scan / retrieval / graph / model latency |
| `neuron_observability_debug` | Toggle debug / retention / demo |

> `neuron_debug_context` remains the **incident** search tool. Use `neuron_trace_context` for “what context was used”.

## Out of scope

- Cloud monitoring
- User tracking
- Analytics platforms

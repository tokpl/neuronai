# Debugging with Neuron

## Goal

Trace every Neuron action so a developer can ask:

> Why did you suggest this?

## CLI

```bash
# Enable verbose traces (default OFF)
neuron debug --on

# Seed a sample operation
neuron debug --demo

# Show last operation + reasoning
neuron explain-last
```

## Debug session example

```text
$ neuron debug --on --demo
Debug mode: ON
Retention: {"mode":"temporary","maxTraces":50,"temporaryHours":24}

=== Verbose reasoning trace ===
user_request: Show me a debug session
↓
context_retrieval: Context retrieval
↓
selected_memories: Selected 1 memories
  refs: CLI debug demo memory
…
```

## Error intelligence

`NeuronErrorAnalyzer` classifies failures into category, root cause, affected module, and a local solution hint (filesystem, auth, latency, schema, …).

## Cursor

When the user asks why Neuron suggested something:

1. `neuron_explain_reasoning`
2. `neuron_trace_last`
3. `neuron_trace_context`

See also [observability.md](./observability.md) and [tracing.md](./tracing.md).

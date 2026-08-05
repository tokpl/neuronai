# Tracing

## NeuronTrace

| Field | Meaning |
|-------|---------|
| `id` | Trace id |
| `operation` | What ran |
| `timestamp` | ISO time |
| `durationMs` | Latency |
| `inputType` / `outputType` | I/O kinds |
| `contextSources` | Filtered sources |
| `modelUsed` | Optional model id |
| `confidence` | 0–1 |

## ReasoningTrace

Linear path:

```text
User request
  ↓
Context retrieval
  ↓
Selected memories
  ↓
Graph traversal
  ↓
Rules applied
  ↓
Model generation
  ↓
Final response
```

## MemoryUsageTrace

Per memory: title, confidence, reason (e.g. related module dependency).

## AIModelTrace

provider, model, tokens in/out, latency, cost estimate, success.

## Debuggers

- **RetrievalDebugger** — query, candidates, ranking, selected (e.g. Found 100 / Selected 8)
- **DecisionDebugger** — recommendation, evidence, confidence

## Security

- Secret filtering (`redactSecrets`)
- Path filtering (`.env`, keys, pem, …)
- Code fences omitted from persisted text
- Configurable `TraceRetentionPolicy`

## Example

```ts
import { createObservabilityEngine } from '@neuron-ai-memory/observability';

const obs = createObservabilityEngine();
await obs.load('.neuron');
obs.recordOperation({
  trace: {
    operation: 'recommend',
    operationKind: 'decide',
    durationMs: 88,
    inputType: 'task',
    outputType: 'recommendation',
    confidence: 0.91,
  },
  reasoning: {
    userRequest: 'New payment service?',
    selectedMemories: ['Payment architecture decision'],
    finalResponse: 'Use existing service',
    finalConfidence: 0.91,
  },
});
await obs.save('.neuron');
await obs.writeReport('.neuron'); // neuron-report.md
```

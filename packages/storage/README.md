# @neuronai/storage

Local runtime and persistence for NeuronAI. No database, no network.

`createNeuronRuntime()` is the **only** way the CLI and the MCP server construct a working
Neuron. Both adapters call it, so there is exactly one wiring of brain, engine and retrieval.

```ts
import { createNeuronRuntime } from '@neuronai/storage';

const runtime = await createNeuronRuntime({ cwd: process.cwd() });

runtime.search('rate limiting');              // ranked memories
runtime.context({ task: 'add rate limiting' }); // compiled agent context
await runtime.persist();                       // atomic write + brain sync
```

## On disk

| Path | Contents | Committed? |
| --- | --- | --- |
| `.neuron/brain/dna.json` | Project identity, stack, structure | yes |
| `.neuron/brain/knowledge.json` | Memories, decisions, rules, graph | yes |
| `.neuron/brain/health.json` | Derived health score | yes |
| `.neuron/prefs.json` | Init answers, privacy mode | yes |
| `.neuron/runtime/store.json` | Regenerable engine store | no |
| `.neuron/cache/` | Scan cache | no |

Durable files under `.neuron/brain/` are the source of truth. Everything under
`.neuron/runtime/` and `.neuron/cache/` can be deleted and rebuilt with `neuron scan`.

All writes go through a temp file and `rename`, so an interrupted write cannot corrupt
the brain.

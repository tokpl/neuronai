# Internal Core API

`NeuronCoreApi` is for **Neuron-owned modules** and the MCP/CLI composition root.

It is **not** a published third-party SDK.

## Surface

```ts
api.listModules()
api.getModule('memory')
api.getConfig('allowCloud', false)
api.emit('MemoryCreated', { id })
api.getService('neuron.eventBus')
api.health()
```

## Bootstrap

```ts
import { createCoreFramework } from '@neuron-ai-memory/core-framework';

const fw = createCoreFramework({
  neuronDir: '.neuron',
  projectConfig: { mode: 'local', allowCloud: false },
});
const api = await fw.boot();
// …
await fw.shutdown();
```

## Config priority

`project` → `env` → `default`

## Errors

`NeuronError`: `category`, `severity`, `module`, `solutionHint`

## Migrations

`NeuronMigrationEngine` registers in-process steps for memory / graph / config schemas — no remote code.

See [core-framework.md](./core-framework.md).

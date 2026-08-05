# Custom agent example

Minimal pattern for embedding Neuron outside Cursor/Claude.

```ts
import { createAccessControl } from '@neuron-ai-memory/security';
import { createNeuronBackupService } from '@neuron-ai-memory/ops';
import { MetricsRegistry, withCorrelationIdAsync } from '@neuron-ai-memory/observability';

async function main() {
  await withCorrelationIdAsync(async () => {
    createAccessControl().assert('memory:read'); // LOCAL_USER by default
    const metrics = new MetricsRegistry();
    metrics.incr('memories.searches');

    // Prefer Memory Engine / Agent Intelligence packages directly
    // rather than re-implementing MCP tool logic in your agent loop.
    console.log('Wire your agent to @neuron-ai-memory/memory-engine + agent-intelligence');
    console.log('Use MCP only when the host speaks MCP.');

    const backup = createNeuronBackupService();
    void backup; // exportJson / exportMarkdown when needed
  });
}

main().catch(console.error);
```

## Principles

1. Don’t store raw chat — store decisions and engineering facts.
2. Use versioned memory updates.
3. Opt in to any remote error reporting via privacy consent APIs.

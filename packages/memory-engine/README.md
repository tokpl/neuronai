# @neuronai/memory-engine

Memory records, versioning and relations. Internal to NeuronAI — not published.

## Layout

- `domain/entities` — Memory, MemoryVersion, MemoryRelation
- `domain/value-objects` — typed scores, status, source, type
- `domain/services` — ImportanceCalculator, MemoryValidator
- `domain/repositories` — persistence ports (interfaces only)
- `use-cases` — application services
- `infrastructure/in-memory` — the in-process store

Persistence to disk lives in `@neuronai/storage`; ranking lives in `@neuronai/brain`.
There is no database adapter and none is planned.

## Usage

```ts
import { createInMemoryMemoryEngine } from '@neuronai/memory-engine';

const engine = createInMemoryMemoryEngine();
await engine.createMemory({
  projectId: 'proj_1',
  type: 'architecture_decision',
  title: 'Rate limiting belongs in middleware',
  content: 'Applied once in middleware so every handler inherits it.',
  source: 'manual',
});
```

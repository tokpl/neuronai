# @neuronai/memory-engine

Domain-driven Memory Core for Neuron AI Memory.

## Layout

- `domain/entities` - Memory, MemoryVersion, MemoryRelation
- `domain/value-objects` - typed scores, status, source, type
- `domain/services` - ImportanceCalculator, MemoryValidator
- `domain/repositories` - persistence ports (interfaces only)
- `domain/events` - domain event types + in-memory publisher
- `use-cases` - application services
- `infrastructure/in-memory` - test/local adapters

Postgres adapters live in `@neuronai/storage`.

## Quick usage

```ts
import { createInMemoryMemoryEngine } from '@neuronai/memory-engine';

const engine = createInMemoryMemoryEngine();
const memory = await engine.createMemory({
  projectId: 'proj_1',
  type: 'architecture_decision',
  title: 'Use Postgres',
  content: 'We chose Postgres over MongoDB for relational integrity.',
  source: 'manual',
});
```

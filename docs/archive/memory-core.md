# Memory Core

Status: **Milestone 1** — implemented domain + Postgres persistence (no embeddings / MCP tools yet).

## Goals

Neuron Memory Core stores **engineering knowledge**, not chat transcripts.

It supports:

- typed memories
- importance / confidence / freshness
- provenance (`source`)
- non-destructive versioning
- typed relations
- lifecycle (`active` → `archived` / `superseded`)
- future embedding hooks (`embedding_id`, `memory_embeddings`)

## Packages

| Package | Role |
|---------|------|
| `@neuron-ai-memory/memory-engine` | Domain entities, value objects, use cases, repository ports |
| `@neuron-ai-memory/storage` | Drizzle schema, SQL migrations, Postgres adapters |

The engine never imports MCP or HTTP layers.

## Memory model

### Types

- `architecture_decision`
- `knowledge`
- `pattern`
- `mistake`
- `context`
- `business_rule`
- `dependency`

### Sources

`agent` | `user` | `git` | `documentation` | `manual`

### Status

`active` | `archived` | `superseded`

### Relations

`depends_on` | `related_to` | `replaces` | `conflicts_with` | `derived_from`

## Lifecycle

1. **Create** — validate → score importance → persist memory + version `1` → `memory.created`
2. **Update / CreateVersion** — bump head version → append `memory_versions` row (history kept)
3. **Archive** — soft deactivate (`archived`)
4. **Context** — rank active memories by importance/freshness within a token budget
5. **Search** — interface only until M2 embeddings

## Database schema

Tables:

- `projects`
- `memories`
- `memory_versions`
- `memory_relations`
- `memory_embeddings` (placeholder for M2 / pgvector)

Apply:

```bash
pnpm docker:up
pnpm db:migrate
```

SQL: `packages/storage/migrations/0001_memory_core.sql`

## Example workflow

```ts
import { createInMemoryMemoryEngine } from '@neuron-ai-memory/memory-engine';

const engine = createInMemoryMemoryEngine();

const memory = await engine.createMemory({
  projectId: '…',
  type: 'architecture_decision',
  title: 'RBAC permissions',
  content: 'Use RBAC instead of hardcoded permission checks.',
  source: 'manual',
});

await engine.updateMemory({
  id: memory.id,
  content: 'Use RBAC with role hierarchy.',
  reason: 'Clarify hierarchy requirement',
});

const ctx = await engine.getProjectMemoryContext({
  projectId: '…',
  maxTokens: 2000,
});
```

Postgres wiring:

```ts
import { createPostgresMemoryStack } from '@neuron-ai-memory/storage';

const stack = createPostgresMemoryStack();
const project = await stack.projects.upsert({ slug: 'sky-gaming', name: 'skyGaming' });
await stack.engine.createMemory({ projectId: project.id, /* … */ });
```

## Design decisions

1. **Value objects in domain** — scores/types validated at the edge of the domain, not only in Zod/DB.
2. **Version rows are append-only** — updates never destroy history (Redux → Zustand stays auditable).
3. **Repository ports in domain** — Postgres is an adapter; in-memory adapters unlock fast tests.
4. **Deterministic ImportanceCalculator** — no AI in M1; interface is swappable for an LLM scorer later.
5. **Search is explicitly unimplemented** — prevents fake keyword CRUD from pretending to be semantic memory.
6. **`embedding_id` + `memory_embeddings` reserved** — schema ready for M2 without forcing vector ops now.

## Out of scope (next)

- Embeddings + hybrid search (M2)
- MCP `memory.*` tools (M3)
- AI extraction / conflict judge (M6)

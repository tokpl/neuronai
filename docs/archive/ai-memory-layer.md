# AI Memory Intelligence Layer

Status: **Milestone 2 / Etap 7** — intelligence pipeline implemented (heuristics + Mock AI; real provider SDKs optional).

## Goal

Convert raw signals into **engineering knowledge**, not a conversation recorder.

Neuron should behave like a senior developer:

> “This matters for the future of the project — remember it.”

## Architecture

```text
Raw input (conversation / diff / commit / docs / agent action)
        │
        ▼
   AIProvider.analyze (optional)
        │
        ▼
   MemoryExtractor  (+ MemoryClassifier)
        │
        ▼
   ImportanceEngine + ImportancePolicy
        │
        ▼
   ConflictDetector
        │
        ▼
   Memory Core (create / supersede / skip / needs_review)
        │
        ▼
   HybridMemorySearchEngine.indexMemory (optional)
```

Packages:

| Package | Role |
|---------|------|
| `@neuron-ai-memory/ai-memory` | Pipeline, classifier, extractor, conflict, search, jobs, eval |
| `@neuron-ai-memory/ai-provider` | `AIProvider` + `MockAIProvider` |
| `@neuron-ai-memory/embeddings` | `EmbeddingProvider`, stores, cosine similarity |
| `@neuron-ai-memory/memory-engine` | Persistence domain / use cases |

## Workflow: input → stored memory

1. **Analyze** — optional LLM pass (mock returns a stub analysis).
2. **Extract** — produce candidate memories (decision / knowledge / pattern / …).
3. **Classify** — heuristics first; AI classification when provider present; `IGNORE` drops noise.
4. **Score** — `ImportanceEngine` combines type prior, impact, usefulness, confidence, source.
5. **Policy** — `auto_save` (≥0.75), `ask_user` (≥0.45), `reject` (below).
6. **Conflict** — duplicate → skip; migration (Redux→Zustand) → archive old + create new; hard contradiction → `needs_review`.
7. **Persist** — Memory Core `createMemory` / versioning.
8. **Index** — embed title+content for hybrid retrieval.

### Example

```ts
import { MockAIProvider } from '@neuron-ai-memory/ai-provider';
import {
  createMemoryIntelligencePipeline,
  HybridMemorySearchEngine,
} from '@neuron-ai-memory/ai-memory';
import { MockEmbeddingProvider, InMemoryEmbeddingStore } from '@neuron-ai-memory/embeddings';
import { createInMemoryMemoryEngine } from '@neuron-ai-memory/memory-engine';

const engine = createInMemoryMemoryEngine();
const searchEngine = new HybridMemorySearchEngine(
  engine.memories,
  new MockEmbeddingProvider(),
  new InMemoryEmbeddingStore(),
);

const pipeline = createMemoryIntelligencePipeline({
  engine,
  ai: new MockAIProvider(),
  searchEngine,
});

const result = await pipeline.process({
  projectId: '…',
  kind: 'conversation',
  text: 'We moved auth into a separate module because we want to scale login independently.',
  autoPersistAskUser: true,
});
```

## Importance scoring

```text
score ≈ type_prior
      + project_impact
      + future_usefulness
      + frequency
      + confidence_boost
      + source_weight
      - short_content_penalty
```

Examples:

- Architecture decision ≈ **0.95** → `auto_save`
- Temporary debugging ≈ **0.15** → `reject`

## Hybrid search algorithm

```text
final = 0.45 * vector_similarity
      + 0.25 * keyword_overlap
      + 0.20 * importance_score
      + 0.10 * freshness_score
```

Then filter by `projectId`, optional types / min importance, sort descending.

## Conflict detection

- **Duplicate** (high Jaccard) → skip
- **Migration** (e.g. Redux vs Zustand + “migrating”) → supersede (archive old, create new)
- **Contradiction** → `needs_review` (ask user / agent)

## Consolidation & jobs

- `MemoryConsolidator` finds near-duplicate groups (caller merges).
- Job interfaces: `memory.extraction`, `memory.embedding`, `memory.consolidation`, `memory.cleanup` (+ `InMemoryJobQueue` for tests). No production broker yet.

## Evaluation

`MemoryEvaluation` reports:

- retrieval accuracy (when eval cases provided)
- duplicate rate
- conflict rate
- usefulness score (importance + usage)

## Out of scope (next)

- MCP `memory.*` tools wiring this pipeline
- Cursor rules/skills
- Real Anthropic/Gemini SDKs (interface ready; use OpenAI-compatible HTTP or mock)
- Postgres/pgvector-backed embedding store

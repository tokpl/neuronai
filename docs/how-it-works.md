# How it works

```text
codebase ──scan──▶ .neuron/brain/ ──retrieve──▶ compile ──MCP──▶ Cursor
                        ▲                                           │
                        └──────────── ask before remembering ◀──────┘
```

## The four concerns

**ProjectBrain** owns persistence and lifecycle: what is on disk under `.neuron/`, how it is
migrated, how it is written (temp file plus rename, so an interrupted write cannot corrupt it).
It does not rank and it does not format prompts.

**Retrieval** decides relevance. Deterministic BM25-style lexical search over titles, tags and
content: term matching with light stemming, exact-phrase and title boosts, and a coverage reward
so a memory matching four of your five task terms beats one matching a single term.

Relevance is a **gate**, not a term in a weighted sum. Importance, freshness and confidence are
applied multiplicatively, so they can reorder memories that already match your task but can
never promote an unrelated one. A memory that shares no subject term with the task is dropped
before scoring, and once a strong match exists, hits below 25% of it are dropped as noise.

**The compiler** selects and compresses. It produces exactly one markdown document, packs it
greedily against a hard token budget, and drops the least valuable section first — patterns
before constraints, constraints before decisions, decisions before warnings. Memory ids,
ranking scores and internal field names never reach it.

**The scanner** reads the codebase and folds what it finds back into the brain: modules become
DNA, relationships become the graph, generated observations become searchable memories, and a
**project map** (modules, files, symbols, routes — always with full paths) becomes retrievable
location knowledge. On supported languages (TypeScript/JavaScript deep pass) it also builds
**code intelligence** inside the same `knowledge.json` plane: exported symbols, verified
`IMPORTS` / `CALLS` / `ROUTE_TO` edges with evidence and confidence. Missing a relationship is
preferred over inventing one. Deleted files disappear from the map and code plane on the next scan.

**Context** (`neuron context` / `neuron_context`) is the product path: intent → concepts →
rank → dependency expansion (verified edges only) → compress against a token budget → small
markdown plus structured `relevantFiles` / `relevantModules` / `relevantRules` / optional
`flow`. Neuron tells the AI *where to start*, *how pieces connect when evidence exists*, and
*which rules apply* — not the contents of every file.

## Principles

1. **Local-first** — knowledge on disk under `.neuron/`, no network calls at runtime
2. **Git is the team brain** — commit `.neuron/brain/` and your team shares one memory
3. **Neuron delivers knowledge, the model writes the code** — it is not an agent
4. **Small MCP surface** — 7 tools, one job each
5. **Explainable** — every hit reports why it matched; every metric says how it was produced

## Install

```bash
npx neuronai init
# or
npm install -g neuronai
neuron init
```

More: [MCP tools](./mcp.md) · [`.neuron/` folder](./neuron-folder.md) · [FAQ](./faq.md)

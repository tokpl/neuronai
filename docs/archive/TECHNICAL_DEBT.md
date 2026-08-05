# Technical Debt — Neuron AI Memory

Reality-based debt list from Etap 44 audit.  
Priority: **P0** must fix before public MVP · **P1** soon after · **P2** later · **P3** freeze/ignore.

| ID | Description | Impact | Priority | Suggested fix |
|----|-------------|--------|----------|---------------|
| TD-001 | Scan writes `scan-memories.json` / markdown but does **not** ingest into `MemoryEngine` / `store.json` | After scan, search/context may be empty → product failure | **P0** | Ingest scan suggestions into engine + index embeddings on scan/init |
| TD-002 | MCP runtime uses `MockEmbeddingProvider` + `MockAIProvider` as default | “Hybrid/semantic” claims overstated; quality capped | **P0** (honesty) / **P1** (real wire) | Document as deterministic offline; optional env-gated real embedder |
| TD-003 | Dual retrieval stacks (`ai-memory` hybrid vs `retrieval-engine`) | Confusion, duplicated maintenance, inconsistent answers | **P1** | One context path for MVP; demote deep tools to experimental |
| TD-004 | ~126 MCP tools registered | Cursor noise; hard to support; looks like “AI does everything” | **P0** | MVP allowlist; hide/defer experimental registrations |
| TD-005 | Postgres stack unused by MCP; no searcher; embeddings placeholder; migrator only `0001` | False “production DB ready” signal | **P1** | Mark experimental; fix migrator or delete unused `0002` from claims |
| TD-006 | `memory-engine` SearchMemory throws without searcher | Footgun for new callers | **P1** | Keep fail-closed; assert in createMemoryEngine docs/tests |
| TD-007 | `createLlmClient` always NotImplemented | Breaks if anything calls it expecting LLM | **P1** | Route all product paths through MockAIProvider or ai-runtime only |
| TD-008 | `core-framework` unused by apps | Dead architecture weight | **P2** | Quarantine / stop documenting as shipping |
| TD-009 | Workspace sqlite/postgres providers are in-memory aliases | Enterprise false confidence | **P2** | Rename to `*FoundationStub` or gate behind feature flag |
| TD-010 | Team sync self_hosted/cloud stubs | Misleading “sync” API | **P2** | Explicit `notImplemented` errors; docs only local |
| TD-011 | Assistant-modes executor returns template findings only | Modes look smart; don’t orchestrate engines | **P2** | Either wire real tool calls server-side or document as prompt router only |
| TD-012 | Architecture-review defaults to `defaultNeuronModules()` | Reviews Neuron-shaped toy graph, not user repo | **P1** | Require scan/graph input; refuse empty with clear error |
| TD-013 | Git intelligence requires manual ingest (no `git log`) | Users expect automatic history | **P2** | Doc clarity; optional live git read later |
| TD-014 | Knowledge-graph non-TS analyzers stubbed | Multi-language claims weak | **P2** | Document TS-first |
| TD-015 | Search candidate cap 200 + full JSON persist | Won’t scale | **P2** | Paging / incremental index plan post-MVP |
| TD-016 | Thin per-package tests; no E2E scan→search | Regressions undetected | **P0** | Add integration test for TD-001 |
| TD-017 | Cursor doctor always soft-OK for binary PATH | False green | **P1** | Probe `neuron`/pnpm exec |
| TD-018 | Planned KG tools not registered (`dependency_tree`, `architecture_query`) | Doc/contract drift | **P1** | Register or remove from contracts |
| TD-019 | Encryption default noop | Fine for local; easy to oversell | **P3** | Keep; document |
| TD-020 | Feature docs historically oversold | Trust damage | **P0** | Keep MVP/experimental labeling; audit MCP tool descriptions |

---

## Top 5 by business risk

1. **TD-001** — broken first-user value loop  
2. **TD-004** — product positioning / support burden  
3. **TD-016** — no test for the broken loop  
4. **TD-002** — honesty of “AI memory” quality  
5. **TD-003** — architectural fragmentation

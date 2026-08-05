# AUDIT REPORT — Neuron AI Memory

**Date:** 2026-08-05  
**Auditor role:** Principal Engineer (reality check)  
**Method:** Static inspection of source + `pnpm test` (77 turbo tasks passed)  
**Rule:** No invented features; claims require file evidence.

---

# Executive Summary

Neuron is a **large monorepo** (~38 packages, 2 apps, **126 MCP tools** registered) with a **working local Cursor path**: CLI init/scan, local JSON memory store, mock-embedding hybrid search, Cursor install/doctor, and many advisory engines.

It is **not** yet a coherent MVP product:

1. **Scan does not populate the searchable memory engine** — it writes `.neuron/*.md` and `scan-memories.json`, while MCP search reads `.neuron/data/store.json`.
2. **Embeddings / LLM in MCP runtime are mocks** (`MockEmbeddingProvider`, `MockAIProvider`).
3. **Postgres path exists in schema but is unused by MCP** and has no searcher / no real pgvector implementation.
4. **Many “intelligence” packages are heuristic advisors** or foundations (workspace DB adapters = in-memory aliases; assistant-modes executor does not call other engines; team sync stubs).
5. **`core-framework` is orphaned** — not depended on by CLI or MCP.
6. **Docs/README previously over-claimed**; MVP docs (Etap 43) partially corrected this, but tool surface still looks like “everything.”

**Verdict:** Architecture direction is sensible for a local project brain. **MVP is not release-ready** until the scan→memory→context loop is one connected system and public claims match mocks vs real backends.

---

# Repository Structure

```text
apps/
  cli/           — real commands (init, scan, doctor, cursor, …)
  mcp-server/    — MCP tools + handlers + local runtime
packages/        — 38 workspace packages
docs/            — extensive (some ahead of code)
examples/        — demo projects
docker/          — compose for optional Postgres
integrations/    — Cursor template copies
tests/           — root/workspace vitest config
```

| Package / app | Purpose | Status |
|---------------|---------|--------|
| `apps/cli` | Developer CLI | **IMPLEMENTED** (smoke-tested) |
| `apps/mcp-server` | MCP + runtime wiring | **PARTIAL** (local works; mocks; scan gap) |
| `types` / `config` | Shared types & config | **IMPLEMENTED** |
| `memory-engine` | Memory DDD core | **PARTIAL** (search requires injected searcher) |
| `storage` | Local JSON + Postgres repos | **PARTIAL** (local OK; Postgres incomplete) |
| `ai-memory` | Pipeline + hybrid search | **PARTIAL** (logic real; mock embeddings in runtime) |
| `embeddings` | Embedding providers | **PARTIAL** (OpenAI-compat exists; MCP uses mock) |
| `ai-provider` | LLM surface | **PARTIAL** (`createLlmClient` → NotImplemented; MockAIProvider used) |
| `project-analyzer` / `project-scanner` | Stack detect + brain bootstrap | **IMPLEMENTED** |
| `knowledge-graph` | Graph + impact | **IMPLEMENTED** (TS regex; other langs stubs) |
| `retrieval-engine` | Multi-source context pipeline | **PARTIAL** (keyword; not default get-context) |
| `agent-intelligence` / `agent-workflow` | Prepare/suggest/privacy | **IMPLEMENTED** (heuristic) |
| `cursor-integration` | MCP/rules/commands install | **IMPLEMENTED** |
| `security` | Redaction / ACL stubs | **PARTIAL** |
| `security-core` / `security-intelligence` | Self-protection / advisor | **IMPLEMENTED** (heuristic; noop encryption default) |
| `observability` | Logger + local traces | **IMPLEMENTED** (OTel = noop) |
| `decision-engine` | Recommendations | **IMPLEMENTED** (heuristic) |
| `workflow-intelligence` (+ git/) | Sessions + git ingest | **IMPLEMENTED** (ingest-driven, not live `git log`) |
| `architecture-review` | Architecture audit | **PARTIAL** (needs supplied graph; else default modules) |
| `assistant-modes` | Mode router | **PARTIAL** (template executor) |
| `ai-runtime` | Model routing | **PARTIAL** |
| `team-brain` / `team-memory` | Shared knowledge | **PARTIAL** (sync stubs) |
| `evaluation-engine` / `benchmark` | Quality/benchmarks | **PARTIAL** (heuristic answers) |
| `memory-governance` / `project-constitution` | Memory health / rules | **PARTIAL**–**IMPLEMENTED** |
| `workspace-core` | Multi-project foundation | **PARTIAL** / foundation |
| `core-framework` | Module bus | **PLACEHOLDER** for runtime (unused by apps) |
| `documentation-intelligence` / `performance-intelligence` / `debug-intelligence` / `architect-mode` / `project-intelligence` | Advisors | **IMPLEMENTED** as heuristics |
| `ops` / `sdk` | Backup / client SDK | **PARTIAL** |
| `docker/` | Postgres compose | **PARTIAL** (optional; not MCP default) |

---

# Feature Status Matrix

| System | Status | Reason |
|--------|--------|--------|
| Memory Engine (CRUD/versioning) | **IMPLEMENTED** | Domain + in-memory repos + tests |
| Memory Search | **PARTIAL** | Works only when searcher injected; engine alone throws `NotImplementedError` (`packages/memory-engine/src/use-cases/search-memory.ts`) |
| Local persistence | **IMPLEMENTED** | `.neuron/data/store.json` via `createLocalFileMemoryStack` |
| Postgres persistence | **PARTIAL** | Migrations/repos exist; MCP never calls; no searcher; embeddings jsonb placeholder; migrator only applies `0001` |
| Project scanner | **IMPLEMENTED** | Writes brain files; CLI/MCP wired |
| Scan → searchable memories | **BROKEN** / gap | Scan writes `scan-memories.json`, not engine `store.json` |
| Knowledge graph | **IMPLEMENTED** | File graph + MCP tools; non-TS analyzers stubbed |
| Retrieval engine (deep tools) | **PARTIAL** | Keyword multi-source; git/docs inputs often empty in MCP |
| Default context (`get_context`) | **IMPLEMENTED** | Uses engine + hybrid search + budget |
| Cursor MCP install | **IMPLEMENTED** | Templates + doctor + tests |
| Real embeddings | **MISSING** in runtime | `MockEmbeddingProvider` in `apps/mcp-server/src/config/runtime.ts` |
| Real LLM completion | **MISSING** / stub | `createLlmClient().complete` throws NotImplemented |
| Core framework runtime | **PLACEHOLDER** | Not imported by apps |
| Team sync | **PLACEHOLDER** | Self-hosted/cloud stubs |
| Workspace DB adapters | **PLACEHOLDER** | SQLite/Postgres classes extend in-memory |
| MCP tool catalog size | **PARTIAL** product-wise | ~126 tools registered — far beyond MVP; many experimental |
| Git live history | **MISSING** | Analyzes supplied commit payloads only |
| Tests | **PARTIAL** | Suite green; mostly 1 file/package; thin for MCP E2E |
| Documentation | **PARTIAL** | MVP docs improved; historical feature lists oversold |

---

# Module Audit

## core-framework

- **Purpose:** Module registry, lifecycle, events, DI.
- **Current state:** Code + tests exist; modules are **name descriptors** only (`BaseNeuronModule.initialize` sets state). **Zero imports from `apps/`.**
- **Problems:** Dead weight for MVP; implies plugin architecture that is unused.
- **Recommendation:** Keep as experimental library; do not market as shipping runtime. Wire later or quarantine.

## memory-engine

- **Purpose:** Memory domain (CRUD, versions, relations, context).
- **Current state:** Solid DDD core; search is a **port**.
- **Problems:** Easy to misread as “search included.”
- **Recommendation:** Keep; document searcher contract; ensure all product paths inject searcher (MCP does).

## knowledge-graph

- **Purpose:** Project structure graph, impact, related knowledge.
- **Current state:** Real file repo + MCP tools; TS analysis is regex MVP; PHP/Python/Java stubs.
- **Problems:** `neuron_dependency_tree` / `neuron_architecture_query` appear in planned contracts but **not** in `register-tools.ts`.
- **Recommendation:** Ship as P0 with honesty about TS-first; register or delete planned tool names.

## retrieval-engine

- **Purpose:** Advanced multi-source context assembly.
- **Current state:** Pipeline implemented; MCP deep tools call it; default path does not.
- **Problems:** Dual retrieval stacks; keyword not semantic; empty git/doc inputs.
- **Recommendation:** Either unify with `get_context` or mark deep tools experimental.

## ai-runtime

- **Purpose:** Provider routing / privacy / model selection.
- **Current state:** Facade + providers; MCP tools exist; defaults to offline/heuristic when unconfigured.
- **Problems:** Not required for MVP local loop; catalog stubs.
- **Recommendation:** P1 experimental; don’t block MVP on it.

## mcp-server

- **Purpose:** Cursor-facing tools + local runtime.
- **Current state:** Large tool surface; local stack wired; auth middleware exists (`NEURON_API_KEY` for cloud mode).
- **Problems:** Tool sprawl; mock AI/embeddings; scan/memory disconnect; no Postgres mode.
- **Recommendation:** Define **MVP tool allowlist**; fix scan ingest; optional real embedder behind env.

## cursor-integration

- **Purpose:** Install MCP/rules/commands; doctor.
- **Current state:** Real and tested.
- **Problems:** Doctor soft-passes MCP binary PATH.
- **Recommendation:** P0 keep; harden doctor PATH check.

## security (+ security-core)

- **Purpose:** Redaction, privacy consent; self-protection layer.
- **Current state:** `redactSecrets` used; security-core MCP tools exist; encryption default noop.
- **Problems:** ACL is stub-level; prompt-injection detector is pattern-based (not a guarantee).
- **Recommendation:** Keep redaction on all persist/trace paths; don’t oversell.

## evaluation

- **Purpose:** Answer/memory quality scoring, benchmarks.
- **Current state:** Local heuristic engine + MCP; offline stub answers in benchmarks.
- **Problems:** Not MVP-critical; easy to confuse with “AI evaluation platform.”
- **Recommendation:** P2; keep off default first-run.

## workspace-core

- **Purpose:** Multi-project / org foundation.
- **Current state:** Models + JSON store + MCP; DB providers are memory aliases.
- **Problems:** Looks enterprise-ready; isn’t.
- **Recommendation:** Experimental only until real adapters exist.

## git intelligence

- **Purpose:** Classify commits, evolution, regression memory.
- **Current state:** Real logic on **ingested** payloads; MCP tools; no automatic `git log`.
- **Problems:** Docs must say “ingest,” not “reads your repo automatically.”
- **Recommendation:** P1 after MVP loop; optional live git read later.

---

# Architecture Review

| Check | Finding | Severity |
|-------|---------|----------|
| Dependencies | Generally acyclic among audited packages | OK |
| Module boundaries | Thin MCP handlers mostly OK; product boundaries blurred by 126 tools | **MEDIUM** |
| Circular deps | No package.json cycles found in audited set | OK |
| Core ≠ app | `core-framework` unused; apps do not depend on it | **LOW** (orphan) |
| Interfaces | MemorySearcher port is correct; Postgres stack omits searcher | **HIGH** |
| Dual retrieval | `ai-memory` hybrid vs `retrieval-engine` pipeline | **HIGH** |
| Scan vs store | Two memory worlds | **CRITICAL** |
| Mock as default | Runtime ships mocks as production path | **HIGH** |
| Tool sprawl | Experimental tools registered alongside P0 | **MEDIUM** |

---

# Code Quality Review

| Issue | Evidence | Severity |
|-------|----------|----------|
| `NotImplementedError` in product ports | `memory-engine` search without searcher; `ai-provider.createLlmClient` | **HIGH** if called unguarded |
| Stub providers | language-stubs, team sync, workspace sqlite/postgres, reranker stubs | **MEDIUM** |
| TODO/FIXME volume | Low in TS (~few); not the main risk | **LOW** |
| Duplication | Multiple “intelligence” facades with similar load/save JSON patterns | **MEDIUM** |
| Thin tests | Most packages: 1 test file; limited MCP integration tests | **HIGH** for release |
| Validation | Zod schemas on MCP tools — good | OK |
| Error handling | `failResult`/`okResult` pattern — generally present | OK |

---

# Database Review

| Item | Reality |
|------|---------|
| Local schema | JSON snapshot `store.json` — adequate for solo MVP |
| Postgres schema | `0001_memory_core.sql` + indexes `0002` |
| Migrations runner | **Only applies 0001** (`packages/storage/src/migrate.ts`) |
| Embeddings | Column/table as **jsonb placeholder**; comment awaits pgvector |
| Indexes | `0002` exists but not auto-applied |
| Relations | Memory relations tables exist in SQL; local in-memory mirrors |
| Local usage | **Yes** |
| Team usage | **Not via DB** today (team-brain is local JSON + sync stubs) |
| Future scaling | Linear search capped ~200 candidates (`ai-memory` search) — **not** ready for large brains without indexing |

**Performance risk:** Full candidate scan + mock vectors will degrade as memory count grows.

---

# MCP Review

| Topic | Reality |
|-------|---------|
| Server | Real stdio MCP app; health tool exists |
| Tools | ~126 `registerTool` calls — Cursor **can** call them |
| Schemas | Zod input schemas widely used |
| Errors | Centralized fail/ok helpers |
| Permissions | Env API key for cloud mode; local largely open |
| Cursor compatibility | **Yes, practically** — install writes `.cursor/mcp.json`; doctor validates structure |

**Can Cursor really use Neuron today?**  
**Yes, for the local path:** enable MCP → `neuron_get_context` / `neuron_search_memory` / `neuron_prepare_task` / `neuron_save_decision` work against local store **if memories were stored via MCP/CLI store paths**.  

**Caveat:** After `neuron scan` alone, searchable memory may still be empty while markdown brain looks “full” — UX failure mode.

---

# Security Review

| Area | Finding | Severity |
|------|---------|----------|
| `.env` | `.env.example` has no live secrets; keys commented | OK |
| Secret exposure | Redaction utilities exist; git/trace paths claim filtering | **MEDIUM** — must verify every persist path |
| Permissions | Local MCP is trusted desktop process | Expected for MVP |
| Input validation | MCP Zod schemas | OK |
| Prompt injection | Pattern detector in security-core — heuristic only | **MEDIUM** |
| Filesystem | Writes under `.neuron/` / `.cursor/` | OK if scoped |
| Encryption | Default noop in security-core | **LOW** for local MVP |

---

# Test Coverage Review

| Exists | Missing / thin |
|--------|----------------|
| Unit tests per package (suite green: 77 turbo tasks) | End-to-end: init → scan → **search finds scan memories** |
| CLI smoke tests | MCP protocol integration tests against real Cursor |
| Storage DB tests gated | Postgres path CI by default |
| cursor-integration install/doctor | Load/perf tests at 10k memories |
| Heuristic engine tests | Contract tests that mocks ≠ production embeddings |

**Critical gap:** No automated test proving scan output is retrievable via `HybridMemorySearchEngine`.

---

# Documentation Review

| Doc claim | Reality |
|-----------|---------|
| MVP docs (Etap 43) | Aligned better with priorities |
| README feature history | Still risks overselling if readers skip “experimental” |
| Roadmap cloud/team | Mostly marked later — OK |
| “Hybrid search” | True algorithmically; **false** if read as cloud embeddings |
| Postgres / pgvector | Schema preview ≠ product |
| Core framework as product | Docs exist; runtime unused — **outdated implication** |
| 126 tools | Undocumented as MVP subset |

---

# Performance Review

| Project size | Expectation |
|--------------|-------------|
| Small (&lt;500 files, &lt;200 memories) | Local path OK |
| Medium | Scan OK; search OK until candidate cap; graph regex limited |
| Large (monorepo 100k+ files, many memories) | **Not designed yet** — linear search, full JSON rewrite on persist, no ANN |

Risks: memory growth in single JSON file; no incremental index; retrieval-engine unused on hot path.

---

# MVP Readiness Score (0–100)

| Dimension | Score | Notes |
|-----------|------:|-------|
| Architecture | **72** | Sensible local-first layering; dual stacks & orphan framework hurt |
| Implementation | **58** | Core loop incomplete (scan→memory); mocks as default |
| Security | **65** | Good defaults/redaction; not a hardened product |
| Testing | **52** | Green but thin; missing critical E2E gap test |
| Documentation | **60** | Improved by MVP docs; still easy to over-read |
| User Experience | **48** | Cursor install OK; empty search after scan is a trust-killer |
| **Overall** | **~59** | **Not MVP-ready for public “it works” claims** |

---

# Related artifacts

- [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md)
- [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)
- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)
- [mvp.md](./mvp.md)

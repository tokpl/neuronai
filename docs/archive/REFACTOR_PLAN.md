# Refactor Plan (no new product features)

Goal: make the **existing** codebase a reliable local MVP — not add capabilities.

---

## Phase 1 — Critical fixes

1. **Connect scan → memory engine** (TD-001)  
   - On `neuron scan` / init analyze: create memories in `MemoryEngine` + `HybridMemorySearchEngine.indexMemory` + persist `store.json`.  
   - Keep markdown brain as export/view, not the only store.

2. **E2E test** (TD-016)  
   - Temp project → init/scan → `searchMemory("architecture")` returns ≥1 hit.

3. **MVP MCP allowlist** (TD-004)  
   - Document and optionally gate experimental tools (env `NEURON_MCP_PROFILE=mvp|full`).  
   - Minimum: health, get_context, search/store/save_decision, prepare_task, project_summary, scan/refresh, cursor-related as needed.

4. **Claim hygiene** (TD-002, TD-020)  
   - Tool descriptions: “local / mock embeddings unless configured.”  
   - README already partially fixed — keep aligned.

---

## Phase 2 — Architecture cleanup

1. **Single context path for MVP** (TD-003)  
   - `get_context` / `prepare_task` remain canonical.  
   - Mark `neuron_deep_search` / optimize-context as experimental or make them wrappers over the same searcher.

2. **Postgres honesty** (TD-005)  
   - Either wire searcher + migrator completely, or label “schema preview” and exclude from doctor “ready” checks.

3. **Quarantine orphans** (TD-008)  
   - `core-framework`: move docs under experimental; no new app coupling until needed.

4. **Architecture-review input** (TD-012)  
   - Fail if no modulesJson and no project graph available.

5. **Doctor PATH** (TD-017) + planned tools cleanup (TD-018).

---

## Phase 3 — MVP completion

1. Optional **real embedding provider** behind env (still no new feature category — completes existing `embeddings` package).  
2. First-run UX: if store empty but brain md exists, prompt “promote scan memories.”  
3. Freeze **neuron/v1 MVP tool subset** in docs.  
4. Release checklist from `docs/release-checklist.md` executed.

---

## Phase 4 — Future improvements (still not new products)

1. Live `git log` ingest (extends existing git intelligence).  
2. Real workspace storage adapters.  
3. Scale search beyond 200 candidates.  
4. Wire assistant-modes to call existing MCP handlers internally (orchestration of **existing** tools).  
5. Graduate experimental packages one-by-one with tests.

---

## Explicitly out of this plan

- SaaS, billing, marketplace  
- Autonomous multi-agent coding  
- New intelligence domains  
- Rewriting the monorepo from scratch

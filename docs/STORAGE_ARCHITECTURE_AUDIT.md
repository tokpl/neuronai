# Storage Architecture Audit — Local-First Neuron

**Date:** 2026-08-05  
**Scope:** Read-only verification — no migration implemented.  
**Question:** Does Neuron actually need PostgreSQL and its own AI API key for the default Cursor → MCP → Neuron → local memory loop?

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Is PostgreSQL required for local Neuron today? | **No.** MCP and CLI already use `createLocalFileMemoryStack` → `.neuron/data/store.json`. |
| Is `OPENAI_API_KEY` required for basic operation? | **No.** Runtime wires `MockAIProvider` + `MockEmbeddingProvider` (local hash embeddings, no network). |
| Can we commit to LOCAL-FIRST + FILE-BASED as the product default? | **Yes — it already is the runtime path.** Docs/`.env.example`/package naming still over-signal Postgres. |
| Is a unified `StorageProvider` (File / SQLite / Postgres) in place? | **No.** Two parallel stories exist; neither matches the proposed contract cleanly. |
| Is current `.gitignore` of entire `.neuron/` correct? | **Too coarse.** It blocks versioning curated brain files that should be shareable. |

**Bottom line:** The *product path* is already local-file. PostgreSQL and OpenAI are optional/future (or unused on the hot path). The work ahead is alignment of abstraction, layout, messaging, and a selective git strategy — not a greenfield rewrite.

---

## 1. Current storage

### What the hot path actually uses

| Consumer | Factory | Path | Backend |
|----------|---------|------|---------|
| MCP server | `createLocalFileMemoryStack` | `apps/mcp-server/src/config/runtime.ts` | `.neuron/data/store.json` |
| CLI session | same | `apps/cli/src/services/project-session.ts` | same |
| Knowledge graph | `createFileGraphRepository` | under `dataDir` | `.neuron/data/graph.json` |

`createPostgresMemoryStack` exists in `@neuron-ai-memory/storage` but is **not** called by MCP or CLI. Grep across apps shows `DATABASE_URL` used only for doctor/status messaging, backup hints, docker, and unused env awareness in `packages/config`.

### Local stack mechanics (`packages/storage/src/local/create-local-file-stack.ts`)

1. Load entire `store.json` into `InMemoryMemoryRepository` (+ versions, relations).
2. Optional `MemorySearcher` attached after construct (MCP injects hybrid search).
3. Every mutating engine wrap in MCP calls `persist()` → **full rewrite** of pretty-printed JSON (memories + versions + relations + embeddings blob).

Domain already scopes by `projectId` (`MemoryRepository.findByProject`, Postgres schema FK, etc.). Local store can hold multiple `projectId`s in one file, but runtime resolves **one project from `cwd`**.

### Parallel / incomplete abstractions

| Location | What it is | Reality |
|----------|------------|---------|
| `memory-engine` ports (`MemoryRepository`, …) | Correct DI for memory CRUD | Used by both in-memory and Postgres repos |
| `createLocalFileMemoryStack` / `createPostgresMemoryStack` | Two factories | No shared `StorageProvider` switch in apps |
| `workspace-core` `StorageProvider` | `save/find/query/delete/migrate` + `workspaceId`/`projectId` | Generic KV; SQLite/Postgres classes **extend in-memory** (foundation stubs) |
| `docs/storage.md` | Documents workspace-core contract | Does **not** describe the real MCP persistence path |

### What lives under `.neuron/` today (observed writers)

Flat / ad-hoc — not the proposed directory tree:

```
.neuron/
├── config.json              # local project config (CLI schema)
├── metadata.json
├── architecture.md          # scanner / brain
├── constitution.md
├── constitution.json
├── decisions.md             # cursor-integration brain
├── project-report.md
├── scan-memories.json       # scanner output — NOT engine store (known gap TD-001)
├── data/
│   ├── store.json           # engine memories (searchable)
│   ├── graph.json
│   └── .keep
├── docs/                    # documentation-intelligence
├── export/
├── backup/
├── integrations/
├── traces.json / neuron-report.md
├── *.json (security, workspace, modes, git-intel, …)
└── …
```

CLI path helper (`apps/cli/src/services/neuron-fs.ts`) only formalizes: `config`, `metadata`, `data/`, `store`, `export/`, `integrations/`.

### Package signal mismatch

`packages/storage/package.json` description still says *"PostgreSQL + pgvector storage adapter"* even though the package also owns the local file stack used in production local mode.

---

## 2. What actually requires PostgreSQL

| Component | Requires Postgres? | Notes |
|-----------|-------------------|--------|
| MCP `createNeuronRuntime` | **No** | Local file only |
| CLI init / status / search session | **No** | Local file |
| `PostgresMemoryRepository` + schema/migrations | Only if you call `createPostgresMemoryStack` | Tests gated by `NEURON_RUN_DB_TESTS=1` |
| Docker compose / `db:migrate` | Ops tooling | Not on default `neuron` / MCP start |
| Doctor check | Soft signal | “Optional: set DATABASE_URL — or use local .neuron/data” |
| CLI status | Soft signal | If `DATABASE_URL` set: “Postgres preferred when wired” (**wording overclaims** — not wired) |

**Nothing in the default Cursor → MCP → save/search/context path opens a DB connection.**

---

## 3. What requires an AI API

### Runtime wiring (fact)

```ts
// apps/mcp-server/src/config/runtime.ts
const embeddings = new MockEmbeddingProvider();
// …
ai: new MockAIProvider(),
```

| Capability | Implementation | Network / API key? |
|------------|----------------|--------------------|
| Embeddings for hybrid search | `MockEmbeddingProvider` → local hash vectors (32-d) | **No** |
| Classify / extract in pipeline | `MockAIProvider` heuristics | **No** |
| `createLlmClient()` | Throws `NotImplementedError` | N/A — avoid calling |
| `OpenAICompatibleEmbeddingProvider` | Exists in `packages/embeddings` | Yes, **if constructed** — unused by MCP |
| `packages/ai-runtime` (Ollama, OpenAI-compat, …) | Separate optional surface + MCP tools | Opt-in; not required for core memory CRUD/search |

### Where “AI” is used and why

| Path | Why AI interface exists | Can work without external provider? |
|------|-------------------------|-------------------------------------|
| `MemoryIntelligencePipeline` (`store_memory`) | Classify / extract / importance assist | **Yes** — Mock heuristics |
| `HybridMemorySearchEngine` | Vector component (0.45 of score) + keyword/importance/freshness | **Yes** — mock/hash embeddings; keyword still works |
| `review-memory` handler | Instantiates `MockAIProvider` again | **Yes** |
| Agent / Cursor itself | Reasoning, codegen | Outside Neuron — **desired model** |

### Separation proposal (no implementation yet)

```
Neuron Core (always local, no API key)
  ├── Memory CRUD + relations + versions
  ├── Keyword / structural search
  ├── File (or later SQLite) persistence
  ├── Project brain markdown / rules
  └── Optional: HeuristicClassifier / HashEmbedder (offline)

Optional AI Provider Integration (explicit enable)
  ├── EmbeddingProvider (OpenAI-compat, Ollama, …)
  ├── AIProvider for extract/classify/summarize quality
  └── ai-runtime routing / privacy checks
```

Cursor/agent remains the primary LLM. Neuron stores and retrieves **project knowledge**; it should not default to being another billed AI gateway.

---

## 4. Is PostgreSQL needed now?

**For local-first MVP / default product: No.**

Keep Postgres as:

- Optional self-hosted backend for large orgs / shared team DB (future).
- Code already partially prepared (`projects` table, `project_id` indexes, repository ports).

Do **not** present `DATABASE_URL` as the first line of `.env.example` without labeling it optional/future — current comment says optional, but the uncommented default URL still reads as “expected.”

---

## 5. Proposed local-first architecture

```
Cursor / AI Agent
    ↓ MCP (stdio)
Neuron MCP / CLI
    ↓ StorageProvider (selected by .neuron/config.json)
FileStorageProvider  ← DEFAULT
    ↓
<project>/.neuron/   (project-local)
```

Principles:

1. **One project root = one `.neuron/`** (cwd / `NEURON_CWD`).
2. **No central DB** required for multi-repo work (see §7).
3. **Secrets stay in `.env` / OS secret store**; project behaviour in `.neuron/config.json`.
4. **Privacy default `localOnly: true`** already in CLI local config schema — preserve and enforce (no cloud/telemetry/remote AI without explicit enable).
5. Postgres/SQLite as *providers behind the same ports*, not alternate products.

### Target `StorageProvider` (memory-focused — design only)

Align with **memory-engine ports**, not only workspace-core KV:

```ts
interface MemoryStorageProvider {
  readonly kind: 'file' | 'sqlite' | 'postgres';
  memories: MemoryRepository;
  versions: MemoryVersionRepository;
  relations: MemoryRelationRepository;
  persist?(): Promise<void>;          // file / batched
  health(): Promise<{ ready: boolean; detail: string }>;
}

// Factory
createMemoryStorage(kind, options): MemoryStorageProvider
```

Map to user names:

| Name | Role |
|------|------|
| `FileStorageProvider` | Evolve today’s `createLocalFileMemoryStack` (+ clearer layout) |
| `SQLiteStorageProvider` | Next local scale-up (single file under `.neuron/`) |
| `PostgresStorageProvider` | Optional / future shared deploy |

`workspace-core.StorageProvider` should either be deferred, narrowed to workspace metadata, or later adapted — **do not pretend it already backs memory.**

---

## 6. FileStorage vs SQLite vs PostgreSQL

Assessment based on **current** implementation limits (full JSON load + full rewrite + hybrid search over ≤200 candidates per query), not marketing claims.

### Current FileStorage (`store.json`) — real limits

| Concern | Behaviour today |
|---------|-----------------|
| Load | Entire snapshot into RAM at startup |
| Write | Serialize **all** memories/versions/relations (+ embeddings) on each persist |
| Search | `findByProject` then score up to **200** active candidates in process |
| Concurrency | Last-write-wins file; no lock protocol |
| Partial update | None — O(total store size) I/O per mutation |

### Comparative fit (guidance)

| Scale | Filesystem (current design) | SQLite (proposed) | PostgreSQL (optional) |
|-------|----------------------------|-------------------|------------------------|
| **1 project, hundreds of memories** | **Fit** — simple, git-diffable exports possible, zero deps | Overkill but fine | Overkill |
| **1 project, ~10k memories** | Risky: large pretty JSON, slow full rewrites, RAM spike, merge pain | **Fit** — indexed `project_id`, transactional writes | Fit if already operating a DB |
| **1 project, ~100k memories** | **Poor** — multi‑MB+ JSON, every save rewrites all; search still scans capped candidate set | Viable with indexes + FTS/vector extension story | Stronger for concurrent writers / ops |
| **10 projects, project-local dirs** | **Fit** — 10× `.neuron/` trees, no shared DB | Same pattern (`*.sqlite` per project) | Central DB only if you *want* one |
| **10 projects, one shared server** | Awkward (many mounts) | Possible shared file (locking hard) | **Fit** |

**Embeddings note:** Today vectors live inside the JSON snapshot / in-memory store. At 10k–100k memories, embedding blobs dominate size → prefer separate index files or SQLite/pgvector, still local-first.

**Keyword vs vector:** Even without external embeddings, keyword overlap already contributes 0.25 of hybrid score; offline hash vectors still “work” but quality is demo-grade. Improving retrieval ≠ requiring OpenAI.

---

## 7. Multi-project strategy

Preferred default:

```
Neuron (CLI/MCP binary)
├── Project A/.neuron/     ← FileStorage
├── Project B/.neuron/
├── Project C/.neuron/
└── Project D/.neuron/
```

- MCP already keys off `cwd` / `NEURON_CWD`.
- `projectId` is derived from project slug (`project-analyzer`) — isolation is **path + id**, not a global DB.
- **Do not** require “Postgres database per project.”
- Shared Postgres (many `project_id` in one DB) remains an **opt-in** deployment mode for teams that want a central store — schema already has `projects` + FKs.

Cross-project queries are out of scope for local-first MVP unless an explicit workspace layer is enabled later.

---

## 8. Git strategy for `.neuron/`

### Problem

Root `.gitignore` currently has:

```
.neuron/
```

That hides **everything**, including curated architecture/decisions that teams may want in git. It matches “local runtime trash” but conflicts with “project brain as living docs.”

### Proposed layout (target)

```
.neuron/
├── config.json              # VERSIONED (no secrets)
├── decisions/               # VERSIONED curated ADRs / decision markdown
├── knowledge/               # VERSIONED curated notes
├── rules/                   # VERSIONED (or pointer to .cursor/rules)
├── memories/                # OPTIONAL versioned curated subset OR export
├── graph/                   # IGNORE generated graph dumps (or version small curated maps only)
├── scans/                   # IGNORE / regenerate
├── indexes/                 # IGNORE (embeddings, FTS)
├── cache/                   # IGNORE
├── state/                   # IGNORE (metadata runtime, traces pointers)
└── data/                    # IGNORE engine store + graph runtime (or migrate into above)
```

Today’s flat `architecture.md` / `constitution.md` map to **versioned** brain; `data/store.json`, traces, backups, scan JSON → **ignored**.

### Suggested ignore pattern (design — not applied yet)

Committed template idea (e.g. written by `neuron init`):

```gitignore
# Neuron — generated / local-only
.neuron/data/
.neuron/cache/
.neuron/indexes/
.neuron/scans/
.neuron/state/
.neuron/backup/
.neuron/export/
.neuron/traces.json
.neuron/**/*.tmp
.neuron/**/security-audit.json
```

**Version (do not ignore):**

- `.neuron/config.json` (ensure no secrets; providers.enabled flags OK)
- `.neuron/architecture.md`, `constitution.md`, `decisions.md` / `decisions/**`
- `.neuron/knowledge/**`, `.neuron/rules/**`
- `.neuron/docs/**` when treated as living project docs
- Optional: curated `.neuron/memories/**/*.md` exports

**Keep ignoring at repo root:** `.env`, `neuron.config.json` if it ever holds secrets (today example is separate).

**`.gitkeep`:** only where empty versioned dirs must exist (`knowledge/`, `decisions/`).

### Dual-config note

Today there are **two** config surfaces:

| File | Role |
|------|------|
| `.neuron/config.json` | Project-local (privacy, scan, integrations) — right place for local-first |
| `neuron.config.json` | Package/schema config loaded by MCP (`packages/config`) — overlaps |

Migration plan should **prefer `.neuron/config.json`** for project behaviour and shrink root `neuron.config.json` / env to overrides + secrets.

---

## 9. Migration plan (phased — analysis only)

### Phase 0 — Honesty (docs + messaging, minimal code)

- Reorder `.env.example`: local-first first; `DATABASE_URL` / `OPENAI_*` clearly **optional/future**.
- Fix CLI status/doctor copy that implies Postgres is “preferred when wired.”
- Update `packages/storage` description; point `docs/storage.md` at the real MCP path.
- Document Mock embeddings as default offline behaviour.

### Phase 1 — Git + layout (no provider rewrite)

- Stop ignoring entire `.neuron/`; ship selective `.gitignore` template from init.
- Gradually move writers into `decisions/`, `knowledge/`, `scans/`, `indexes/` **or** document current flat files under VERSIONED vs IGNORED tables.
- Do not break existing `data/store.json` readers in the same change set without adapters.

### Phase 2 — `FileStorageProvider` as named default

- Thin façade over `createLocalFileMemoryStack` implementing a single provider interface.
- Config key: `storage.provider = "file"` in `.neuron/config.json`.
- Keep Postgres factory behind `storage.provider = "postgres"` (explicit).

### Phase 3 — SQLite provider (when File hits scale pain)

- Single `.neuron/data/neuron.sqlite` (ignored by git).
- Implement same repository ports; optional FTS.
- Trigger: documented thresholds (e.g. store.json ≫ few MB, or memory count ≫ few thousand).

### Phase 4 — Optional AI provider integration

- Core path remains Mock/heuristic unless `providers.embeddings` / `providers.llm` enabled **and** keys/endpoints present.
- Never require `OPENAI_API_KEY` for init/MCP start/search.

### Explicit non-goals for this migration

- No new SaaS.
- No mandatory central DB.
- No large parallel “storage framework” in `workspace-core` until memory provider is clear.
- No deleting Postgres code — demote to optional adapter.

---

## 10. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Full-file rewrite corruption / lost updates | Medium | Atomic write (temp + rename); later SQLite |
| Selective gitignore ships while init still writes only to ignored paths | Medium | Version curated markdown; keep engine data ignored |
| Dual config (`neuron.config.json` vs `.neuron/config.json`) confuses users | Medium | Single source of truth in Phase 1–2 |
| `workspace-core` StorageProvider mistaken for production memory API | High (design drift) | Document as foundation/stub; don’t wire MCP to it yet |
| Scan → `scan-memories.json` not ingested into `store.json` (TD-001) | **High (product)** | Orthogonal to Postgres removal but blocks “memory works after scan” |
| Messaging still sells Postgres/OpenAI | Medium | Phase 0 copy fixes |
| Pretty-printed 10k+ JSON + embeddings in git if someone force-adds `data/` | Medium | Keep `data/` ignored; educate in docs |
| Mock embeddings oversold as “semantic search” | Medium | Honesty in docs (already flagged in prior audits) |
| Removing Postgres deps from package too early | Low | Keep optional dependency / separate export path |

---

## Evidence index (key paths)

| Topic | Path |
|-------|------|
| MCP local stack | `apps/mcp-server/src/config/runtime.ts` |
| Local JSON stack | `packages/storage/src/local/create-local-file-stack.ts` |
| Postgres stack (unused by apps) | `packages/storage/src/create-postgres-stack.ts` |
| Memory ports | `packages/memory-engine/src/domain/repositories/memory-repository.ts` |
| Hybrid search | `packages/ai-memory/src/search/memory-search-engine.ts` |
| Mock AI | `packages/ai-provider/src/index.ts` |
| Mock embeddings | `packages/embeddings/src/index.ts` |
| Local config defaults (`localOnly: true`) | `apps/cli/src/config/local-config.ts` |
| Env template | `.env.example` |
| Root ignore of all `.neuron/` | `.gitignore` |
| Workspace stub provider | `packages/workspace-core/src/storage/provider.ts` |

---

## Conclusion

Neuron **can and already does** run as:

**Cursor/agent → MCP → Neuron → project-local files**

without PostgreSQL and without OpenAI.

What is missing is not a new database — it is:

1. A clear **File-first `StorageProvider`** story (SQLite next, Postgres optional),
2. A **selective `.neuron/` git strategy**,
3. **Config/env messaging** that matches reality,
4. Keeping **AI providers optional** on top of a no-network core.

No full migration was implemented in this pass; this document is the decision basis for the next incremental steps.

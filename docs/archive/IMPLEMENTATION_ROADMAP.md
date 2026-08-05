# Implementation Roadmap — Working MVP (no new features)

This roadmap only closes gaps in **what already exists**, so Neuron delivers:

> Install → init → scan → Cursor → **useful answer from project memory**

Aligned with [mvp.md](./mvp.md) and [AUDIT_REPORT.md](./AUDIT_REPORT.md).

---

## Milestone M0 — Truth (done when docs match code)

- [x] Product priority docs (Etap 43)  
- [x] Full audit (Etap 44)  
- [ ] MCP tool descriptions updated for mock/local defaults  
- [ ] Experimental tools labeled in `docs/mcp-server.md` (MVP vs full)

---

## Milestone M1 — Broken loop fix (blocking)

**Owner focus:** storage + scanner + mcp runtime

- [ ] Scan/init promotes memories into `MemoryEngine` + search index  
- [ ] Persist embeddings snapshot with store  
- [ ] Integration test: scan → search hit  
- [ ] CLI report shows searchable memory count (= engine), not only scan-memories JSON count  

**Exit criteria:** Fresh `neuron init` + scan → `neuron_search_memory` returns project-specific hits without manual `store_memory`.

---

## Milestone M2 — MVP surface

- [ ] Define allowlist of MCP tools for profile `mvp`  
- [ ] Default profile = mvp (or document how to enable full)  
- [ ] Cursor commands/rules only advertise MVP tools  
- [ ] Doctor verifies: store.json exists + memory count &gt; 0 after scan  

**Exit criteria:** New user path uses ≤15 primary tools; experimental available but not default noise.

---

## Milestone M3 — Honesty + quality floor

- [ ] Document mock embeddings; optional `OPENAI_API_KEY` / compatible embedder wiring using **existing** `embeddings` package  
- [ ] Architecture-review refuses toy default graph without user/project input  
- [ ] Postgres marked experimental in doctor/README until searcher wired  
- [ ] Remove or implement planned-but-unregistered KG tool names  

**Exit criteria:** No CRITICAL false claims in README/MCP descriptions.

---

## Milestone M4 — Release candidate

- [ ] Execute [release-checklist.md](./release-checklist.md)  
- [ ] Demo script proves first useful answer on `examples/neuron-demo`  
- [ ] Tag candidate with known limitations list (mock embeddings, local-only, TS-first graph)  

**Exit criteria:** Overall audit score dimensions Implementation ≥70, UX ≥70, or documented waivers.

---

## Non-goals (do not schedule here)

- Cloud sync / SaaS  
- Team Brain GA  
- Workspace enterprise GA  
- New analyzers / new modes / new intelligence packages  
- Replacing mocks with a full LLM platform  

---

## Suggested order of work (engineers)

1. TD-001 + TD-016 (M1)  
2. TD-004 (M2)  
3. TD-002/TD-020 + TD-012 + TD-005 labeling (M3)  
4. Checklist + demo (M4)  

Everything else waits.

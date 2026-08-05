# Production audit (pre-1.0)

Date: 2026-08-05 · Scope: Neuron AI Memory monorepo (local-first MCP core)

## Summary

Neuron is **feature-complete for an open-source local core** (memory, MCP, CLI, graph, agent intelligence) but **pre-1.0**: storage defaults to local JSON, Postgres is optional, and cloud multi-tenant is intentionally unfinished.

Overall readiness for **public OSS local use**: **GO with caveats**.  
Readiness for **hosted multi-tenant SaaS**: **NO** (by design).

## Dependency risks

| Area | Risk | Mitigation |
|------|------|------------|
| `@modelcontextprotocol/sdk` | Protocol churn | Pin versions; `neuron/v1` API surface |
| `drizzle` / `postgres` | Optional path | Local JSON works offline |
| AI provider keys | Leak via logs | Redaction helpers; never log env |
| Monorepo workspace packages | Publish complexity | Publish CLI meta-package first |

## Single points of failure

1. **Local `store.json` / `graph.json`** — corruption loses project brain → backups (`neuron backup`)
2. **In-process MCP** — crash kills session → health + doctor; restart stdio
3. **No HA Postgres story yet** — document operator-managed replicas for self-host

## Architectural issues (known)

- Hybrid search uses hash embeddings by default (deterministic, not SOTA)
- Graph TS analyzer is regex-based (not full compiler API)
- ACL roles are stubs for future cloud (local = full access)
- MCP graph bootstrap on first start can be slow on huge repos (cap file walks)

## Scaling notes

| Scale | Local JSON | Postgres + indexes |
|-------|------------|--------------------|
| ≤10k memories | Fine | Fine |
| 100k | Acceptable with care | Recommended |
| 1M+ | Not recommended | Required + partitioning roadmap |

See `migrations/0002_production_indexes.sql` and `docs/benchmarks.md`.

## Security findings

- Local-first: data stays under `.neuron/` unless user exports or enables cloud
- Secrets: use env only; `redactSecrets` for logs
- Telemetry: **opt-in only** (`PrivacyConsent` defaults false)
- Auth: local mode open; cloud mode API key ready

## Recommendations before v1.0

1. Publish `0.1.0` CLI + MCP with clear “local beta” label  
2. Document backup/restore as day-0 ops  
3. Add apply mode for `neuron maintain`  
4. Harden Docker image (non-root, healthcheck)  
5. Expand E2E against real Cursor only as manual checklist

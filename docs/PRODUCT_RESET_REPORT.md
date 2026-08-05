# Product Reset — Success Report

Date: 2026-08-05

## 1. Removed

- **MCP tools:** 126 → **12** (handlers for non-MVP domains deleted from registration)
- **CLI commands:** benchmark, watch, constitution, backup suite, debug, analyze, export, suggest, update, explain, … → MVP set only
- **Packages moved to `future/`:** architect-mode, architecture-review, assistant-modes, debug/documentation/performance/workflow-intelligence, decision-engine, evaluation-engine, benchmark, memory-governance, project-constitution, project-intelligence, security-intelligence, team-brain, team-memory, workspace-core, core-framework, sdk, ai-runtime, ops, security-core, storage-postgres, docker
- **Docs:** ~100 non-MVP docs → `docs/archive/`
- **Root scripts:** `docker:*`, `db:migrate` removed from default `package.json`

## 2. Simplified

- Storage: **FileStorageProvider** only on hot path
- `.neuron/` readable JSON brain + ephemeral runtime/cache
- `.gitignore` selective (version knowledge, ignore cache)
- Cursor install: 5 command prompts (not 12+)
- Config / doctor messaging: no Postgres required

## 3. New architecture

```text
Cursor → Neuron MCP (12 tools) → Core → FileStorageProvider → .neuron/
Team share = git pull of versioned *.json
```

## 4. Package structure (active)

**Apps:** `cli`, `mcp-server`

**Packages:** types, config, memory-engine, storage, embeddings, project-scanner, project-analyzer, knowledge-graph, retrieval-engine, cursor-integration, security, ai-memory, ai-provider, agent-intelligence, agent-workflow, observability

(~16 packages + 2 apps; non-MVP in `future/`)

## 5. README

Rewritten with hero, before/after, Quick Start (`npm i -g neuron`), architecture, `.neuron/`, MCP table, FAQ links, and placeholders under `docs/assets/*.svg`.

## 6. MVP scope

See [docs/mvp.md](./docs/mvp.md) — eight capabilities; no cloud/enterprise.

## 7. Release checklist

See [docs/release-checklist.md](./docs/release-checklist.md) — product honesty items done; manual Cursor smoke still required before tag.

## 8. Ready to show people?

**Yes, with caveats:**

| Ready | Gap |
|-------|-----|
| Code surface matches product story | Final PNG/GIF artwork still placeholders |
| Local install path documented | npm name `neuron` may need availability check at publish |
| Build passes | Run full `pnpm test` + Cursor manual smoke before public announce |

Neuron is now a **product** (local memory for Cursor), not a 40-package enterprise experiment.

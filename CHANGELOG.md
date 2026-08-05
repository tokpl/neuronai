# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-08-05

First **public local beta** for solo developers using **Cursor**.

### Works (supported)

- CLI: `neuron init`, `init cursor`, `analyze`, `search`, `status`, `doctor`, `cursor setup|doctor`, backup/restore/purge/maintain
- MCP server over stdio (`neuron mcp`) with `neuron/v1` tool surface
- Local file memory store (`.neuron/data`)
- Hybrid search, versioned updates, decision save/review
- Agent intelligence: prepare / review / plan / impact / Q&A
- Knowledge graph + project brain markdown exports
- Cursor rules, skills, command prompts, Context Budget Manager
- Project Constitution advisor (`neuron constitution`, MCP rule/health/evolution tools)
- Advanced Retrieval Engine (multi-source, ranking, compression, context assembly)
- Local-first privacy (telemetry off by default)

### Experimental

- Postgres + pgvector storage and production indexes
- Docker compose for self-host experiments
- Cloud mode / API key auth stubs
- ACL roles beyond `LOCAL_USER`
- Error reporter / OTel abstractions (noop until opted in)

### Later (explicitly out of scope for 0.1)

- Team / organization shared memory
- Cloud SaaS, billing, enterprise dashboard
- First-class Claude Code / VS Code extension DX
- Guaranteed MCP API freeze (planned toward 1.0)

### Added

- Public demo app [`examples/neuron-demo`](./examples/neuron-demo)
- Demo capture scripts under [`docs/demo/`](./docs/demo/)
- README overhaul, [DEVELOPMENT.md](./DEVELOPMENT.md), [docs/roadmap.md](./docs/roadmap.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
- Polished `neuron init` first-run welcome + actionable MCP errors
- GitHub issue forms (`bug.yml` / `feature.yml`), label set, discussion templates

### Security

- Local-first defaults; secret redaction helpers; no telemetry without consent

[0.1.0]: https://github.com/YOUR_ORG/neuron-ai-memory/releases/tag/v0.1.0

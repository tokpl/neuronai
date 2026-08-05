# Neuron AI Memory

**Persistent project memory for Cursor AI agents.**

Mem0 remembers people. Neuron remembers the *codebase’s decisions*.

Local-first · MCP · Apache-2.0 · **v0.1.0**

---

## Problem

AI coding agents in Cursor start almost every chat from zero.

They forget:

- why you chose Postgres over Mongo
- which module owns payments
- that you already banned DB access from controllers
- the footguns that burned last sprint

Repo RAG finds *code*. It does not remember *engineering judgment*.

## Solution

Neuron is a **local project brain** for Cursor:

1. Stores decisions, patterns, warnings, and structure
2. Exposes them through MCP tools (`neuron_prepare_task`, `neuron_get_context`, …)
3. Caps context with a **Context Budget Manager** (top facts for *this* task — not 10 000 memories)

Your agent stops reinventing architecture every session.

## Features

**MVP (P0) — AI that understands your project:**

| Feature | What you get |
|---------|----------------|
| **Project scanner** | Bootstrap `.neuron/` brain from the codebase |
| **Project memory** | Versioned decisions, patterns, warnings |
| **Knowledge graph** | Modules + relations for context |
| **Budgeted retrieval** | Top facts for *this* task — not 10 000 memories |
| **Cursor MCP** | Rules, skills, commands, `neuron init cursor` |
| **Basic reasoning** | Prepare / search / save decision |
| **Local privacy** | Telemetry OFF; secrets redacted |

**Later / experimental** (not the MVP promise): architecture review, docs generation, git history, team brain, evaluation, workspace enterprise, assistant modes, etc.  
See [docs/mvp.md](./docs/mvp.md) and [docs/product-architecture-review.md](./docs/product-architecture-review.md).

## How it works

```text
Cursor
  ↓
Neuron MCP  (neuron/v1)
  ↓
Memory Engine
  ↓
Knowledge Graph
  ↓
Project Intelligence
```

Data stays on disk by default (`.neuron/data`). Optional Postgres + pgvector for larger installs.

## Quick Start (5 minutes)

**Requirements:** Node.js 22+, pnpm 9+, [Cursor](https://cursor.com)

```bash
git clone https://github.com/YOUR_ORG/neuron-ai-memory.git
cd neuron-ai-memory
pnpm install && pnpm build

cd /path/to/your-app
pnpm --dir /path/to/neuron-ai-memory neuron init cursor
pnpm --dir /path/to/neuron-ai-memory neuron cursor doctor
```

1. Open the app in **Cursor** → enable MCP server **neuron**
2. New chat: *“Prepare adding a payment system using Neuron”*
3. Expect `neuron_prepare_task` / `neuron_get_context`
4. After a real decision: *“Save this with Neuron”*

Walkthrough screenshots (scripted): [docs/demo/](./docs/demo/)

## Examples

| Scenario | Path |
|----------|------|
| **Full demo app** (FE + BE + DB + decisions) | [examples/neuron-demo](./examples/neuron-demo) |
| Architecture decision | see demo `decisions.md` + README scenarios |
| Refactor / debugging | [docs/cursor-workflow.md](./docs/cursor-workflow.md) |
| Cursor wiring only | [examples/cursor-example](./examples/cursor-example) |

### Architecture decision (example)

> “We route payments through an event-driven outbox — never write to the ledger from HTTP handlers.”

Agent calls `neuron_save_decision` → appears in search and `.neuron/decisions.md`.

### Refactor (example)

> “Extract billing from `orders`.”

`neuron_analyze_impact` + `neuron_prepare_task` surface module boundaries and prior warnings.

### Debugging (example)

> “Duplicate charges in staging.”

`neuron_search_memory` finds “Do not access database directly from controllers” and the outbox pattern.

## What works in v0.1.0 (MVP)

- Local Cursor MCP + CLI first-run (`init`, `scan`, `explain`, `doctor`, Cursor setup) — [docs/first-run.md](./docs/first-run.md)
- Memory engine + hybrid search (local JSON store)
- Project scanner → architecture / stack / brain files
- Knowledge graph (project structure)
- Agent intelligence basics (prepare / search / save decision)
- Context Budget Manager
- Privacy defaults (local-only, telemetry OFF)

### Experimental (in repo, not MVP-stable)

- Architecture review, assistant modes, git intelligence depth
- Team Brain, evaluation engine, performance/debug advisors
- Security-core / observability product traces
- Workspace-core enterprise foundation
- Core framework full module bus
- AI runtime multi-provider
- Postgres + pgvector path
- Cloud `NEURON_MODE` / API-key stubs

### Later (not in 0.1)

- Cloud SaaS, billing, dashboards, marketplace
- Enterprise IAM as GA
- Autonomous multi-agent coding

## Roadmap

| Version | Focus |
|---------|--------|
| **v0.1** | Local Project Brain *(MVP)* |
| **v0.2** | Daily depth (architecture, docs, git, resume) |
| **v0.3** | Advanced local (team, governance, evaluation) |
| **v1.0** | Production-ready engineering memory |

Details: [docs/roadmap.md](./docs/roadmap.md) · [docs/mvp.md](./docs/mvp.md)

## Community

- **GitHub Discussions** — Q&A and ideas (enable on the repo)
- **Discord** — placeholder invite in [SUPPORT.md](./SUPPORT.md) (add when community launches)
- **FAQ** — [docs/faq.md](./docs/faq.md)

### FAQ highlights

- *Does Neuron send my code anywhere?* — **No by default.** Local-first.
- *Different from ChatGPT memory?* — Project engineering memory, not chat persona.
- *Offline?* — Yes for local store (no cloud required).
- *Why MCP?* — Standard tool protocol for Cursor agents.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md), [DEVELOPMENT.md](./DEVELOPMENT.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

Good first issues: [docs/good-first-issues.md](./docs/good-first-issues.md)

## Security

[SECURITY.md](./SECURITY.md) — report privately; never file public vulns.

## License

[Apache-2.0](./LICENSE)

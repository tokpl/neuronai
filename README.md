<p align="center">
  <img src="./docs/assets/logo.png" alt="NeuronAI" width="72" />
</p>

<h1 align="center">NeuronAI</h1>

<p align="center"><b>A local-first Project Brain for AI coding assistants.</b></p>

<p align="center">
  NeuronAI builds a local Project Brain so your AI coding agent knows where to look,
  what depends on what, and which project rules apply — before it starts exploring.
</p>

<p align="center">
  <a href="https://github.com/tokpl/neuronai"><img alt="GitHub" src="https://img.shields.io/badge/github-tokpl%2Fneuronai-black?logo=github" /></a>
  <a href="https://www.npmjs.com/package/neuronai"><img alt="npm" src="https://img.shields.io/badge/npm-neuronai-cb3837?logo=npm" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-no%20cloud-informational" />
  <img alt="Node" src="https://img.shields.io/badge/node-%E2%89%A522-brightgreen" />
</p>

```bash
npm install -g neuronai && cd your-project && neuron init
```

<p align="center">
  <img src="./docs/assets/hero.png" alt="NeuronAI — give Cursor long-term memory" width="920" />
</p>

---

## The problem

Every new chat starts from zero. You re-explain the architecture, the conventions, the thing
you tried last quarter that broke production. Then the agent confidently proposes it again.

<p align="center">
  <img src="./docs/assets/problem.png" alt="Without memory every chat forgets — with Neuron you write the decision once" width="920" />
</p>

**Without a project brain**

> **You:** Add rate limiting to the API.
> **Agent:** I'll add an in-memory counter to each route handler.
> **You:** No. We decided rate limiting goes in middleware, once, for everything.

**With one**

> **You:** Add rate limiting to the API.
> **Agent:** *(reads project memory)* This project decided rate limiting belongs in the
> middleware layer so every handler inherits it, rather than per-handler throttling.
> I'll add it there.

That knowledge lives in `.neuron/` in your repo, in plain JSON, versioned in Git alongside
the code it describes.

<p align="center">
  <img src="./docs/assets/solution.png" alt="Write once. Remembered forever — agent adapted to your architecture" width="920" />
</p>

---

## See it in Cursor & Antigravity IDE

Neuron does **not** replace the coding assistant. It removes repetitive project rediscovery.
Your IDE is told (via generated rules for Cursor or Antigravity) to call `neuron_context` **before** broad repository
exploration, then open the returned paths.

<p align="center">
  <img src="./docs/assets/before-after.png" alt="Without project memory vs with NeuronAI project memory in Cursor chat" width="920" />
</p>

<p align="center">
  <img src="./docs/assets/demo.png" alt="Init once → memory in .neuron/ → ask in Cursor → answers use your architecture" width="920" />
</p>

---

## Why it helps

<p align="center">
  <img src="./docs/assets/cards.png" alt="Less repeating, agent fits your project, decisions stick, Git share, local-first, no API key" width="920" />
</p>

---

## How it works

```text
codebase ──scan──▶ .neuron/brain/ ──retrieve──▶ compile ──MCP──▶ Cursor
                        ▲                                          │
                        └────────── ask before remembering ◀───────┘
```

<p align="center">
  <img src="./docs/assets/architecture.png" alt="Your repo → .neuron memory → ranked context in Cursor" width="920" />
</p>

### Scan builds the brain

`neuron init` / `neuron scan` walks the repo, detects stack and modules, and writes durable
brain files. Structural code intelligence (symbols, verified imports/calls/routes) lives in the
**same** `knowledge.json` plane — not a second index, not embeddings.

<p align="center">
  <img src="./docs/assets/scan-flow.png" alt="Codebase scan detects stack and writes .neuron brain files" width="920" />
</p>

<p align="center">
  <img src="./docs/assets/knowledge-graph.png" alt="Modules, decisions, and patterns connected in project memory" width="720" />
</p>

### Compact context on every task

**Retrieval** is deterministic BM25-style lexical ranking over memories, map locations, and code
symbols. Relevance is a **gate** — importance never promotes an unrelated memory. When evidence
exists, expansion follows high-confidence edges (start → related → dependency).

**Brain Compression** packs one markdown document against a hard token budget
(500 / 1200 / 3500 for minimal / standard / deep).

```bash
neuron context "Where should I add a payment endpoint?"
```

```text
Project Brain
────────────────────────

Recommended:
  src/billing/service.ts

Rules:
  Never call the payment provider directly from route handlers

Context: 182 / 2143 tokens · 8 ms · MODIFICATION
```

`estimatedTokensSaved` compares compiled context to pasting the whole brain — **not** a claim
about the model's full session bill.

---

## Install & quick start

```bash
npm install -g neuronai
cd your-project
neuron init
```

Node.js 22+. Or: `npx neuronai init`. One package, one dependency (`@modelcontextprotocol/sdk`).

<p align="center">
  <img src="./docs/assets/quickstart.png" alt="Quick start: install, neuron init, enable MCP" width="920" />
</p>

<p align="center">
  <img src="./docs/assets/cursor-workflow.png" alt="Developer workflow: install → init → open IDE → ask with project context" width="920" />
</p>

Init detects the project, writes the brain, and wires your selected IDE. Real output sketch:

```text
[5/8] Initial scan…
✓ Mapped 5 modules across 15 files
✓ Learned 21 things about this project
[7/8] IDE integration…
✓ Created Cursor rules + MCP (.cursor/)
✓ Created Antigravity IDE rules + MCP (~/.gemini/config/mcp_config.json)
```

### Connect your IDE

During `neuron init` you can select which IDE to configure:
- **Cursor**: Writes `.cursor/mcp.json` and agent rules. Then **Settings → Tools & MCP → enable "neuron"**.
- **Antigravity IDE**: Writes `~/.gemini/config/mcp_config.json` and project rules (`.antigravity/rules/`). Then open **Settings → Customizations → Installed MCP Servers → Click Refresh**.

After upgrading NeuronAI, reload your IDE's MCP tool list so it refreshes to the current **7 tools**.

```bash
neuron cursor     # Cursor connection status
neuron doctor     # stdio catalog + IDE reload guidance
```

---

## What lives on disk

<p align="center">
  <img src="./docs/assets/folder-structure.png" alt=".neuron folder structure on disk" width="920" />
</p>

```text
.neuron/
├── prefs.json            # your init answers                 (commit)
├── brain/
│   ├── dna.json          # stack, modules, structure         (commit)
│   ├── knowledge.json    # memories, decisions, rules, code  (commit)
│   └── health.json       # derived health score              (commit)
├── runtime/store.json    # regenerable engine store          (ignored)
└── cache/                # scan cache                        (ignored)
```

Commit `.neuron/brain/` and your team shares one project memory.

---

## Ask before remembering

Neuron never writes a memory you did not approve. After a change the agent proposes a draft and
asks **Yes · Edit · No**. From the terminal:

```bash
neuron remember "Rate limiting belongs in middleware, not individual handlers"
```

---

## MCP tools

Seven tools, one job each. Full reference: [`docs/mcp.md`](./docs/mcp.md).

| Tool | Purpose |
| --- | --- |
| `neuron_context` | Ranked, compressed project knowledge for a task — **call first** |
| `neuron_search` | Keyword search over memories |
| `neuron_remember` | Store a decision, pattern, warning or fact |
| `neuron_update` | Change a memory (versioned) |
| `neuron_after_task` | Propose what to remember after coding |
| `neuron_resolve_suggestion` | Apply Yes / Edit / No |
| `neuron_scan` | Rebuild the brain from the codebase |

---

## Local-first (tested)

| | |
| --- | --- |
| Cloud services | none |
| API keys | none |
| Database | none — plain JSON files |
| Telemetry | none |
| Network at runtime | none (`pnpm verify:offline`) |

---

## Honest metrics

```bash
neuron brain
```

Keep these labels separate:

| Label | Meaning |
| --- | --- |
| **Brain compression** | Whole brain → compiled `neuron_context` (measured) |
| **Exploration policy** | Scripted baseline vs Neuron ops (simulated) |
| **Live agent proof** | Real Cursor tool traces — measured on hard MCP A/B for this release; **not** token/latency savings |

Never call Brain compression “agent token savings.” Never call the scripted exploration harness a
live-agent result. Details: [`docs/FINAL_RELEASE_AUDIT.md`](./docs/FINAL_RELEASE_AUDIT.md),
[`docs/LIVE_AGENT_MCP_VALIDATION.md`](./docs/LIVE_AGENT_MCP_VALIDATION.md).

---

## Commands

| Command | What it does |
| --- | --- |
| `neuron init` | Detect the project, build the brain, wire Cursor / Antigravity IDE |
| `neuron scan` | Re-learn from the codebase (`--deep`, `--update`) |
| `neuron search <query>` | Search what the project knows |
| `neuron context <task>` | Show compact context for a task |
| `neuron remember <text>` | Add something yourself |
| `neuron brain` | Metrics: measured, derived, estimated |
| `neuron status` | Project and memory overview |
| `neuron cursor` | Cursor connection status |
| `neuron doctor` | Diagnose brain, storage and IDE setup |
| `neuron mcp` | MCP server (Your IDE calls this) |

---

## Roadmap

Local OSS stays free. Cloud is optional convenience — not required for the core product.

<p align="center">
  <img src="./docs/assets/roadmap.png" alt="Roadmap: local OSS now; optional cloud console, sync, and hosted extras later" width="920" />
</p>

---

## Architecture (monorepo)

```text
apps/cli          the neuron binary (bundled, self-contained)
apps/mcp-server   MCP server over stdio
packages/brain    ProjectBrain, retrieval, compiler, dedupe
packages/storage  the one runtime construction path
packages/*        scanner, config, types, Cursor integration
```

More: [How it works](./docs/how-it-works.md) · [`.neuron/` folder](./docs/neuron-folder.md) ·
[FAQ](./docs/faq.md) · [Privacy](./docs/privacy.md) ·
[Production readiness](./docs/PRODUCTION_READINESS.md).

## Contributing

```bash
pnpm install
pnpm verify   # lint, typecheck, test, build, package + offline checks
```

See [CONTRIBUTING](./CONTRIBUTING.md). Issues:
[open an issue](https://github.com/tokpl/neuronai/issues).

## License

[AGPL-3.0](./LICENSE). Name and logo: [TRADEMARK](./TRADEMARK.md).
Security: [SECURITY](./SECURITY.md).

<p align="center">
  <a href="https://github.com/tokpl/neuronai">github.com/tokpl/neuronai</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/logo.png" alt="NeuronAI" width="72" />
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

---

## The problem

Every new chat starts from zero. You re-explain the architecture, the conventions, the thing
you tried last quarter that broke production. Then the agent confidently proposes it again.

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

## Your AI already knows where to look

Neuron builds a map of your project and gives your AI the relevant parts when it needs them.

**Neuron does not replace the coding assistant.** It removes repetitive project rediscovery.

```text
Without NeuronAI

AI receives: "Add payment cancellation."

AI:
- searches folders
- searches files
- searches symbols
- rediscovers architecture
- rereads rules
- spends tokens discovering the project

With NeuronAI

AI receives:
- billing module
- relevant files / symbols
- architecture + project rules
- remembered decisions

Then it reads only what matters.
```

Cursor is told (via the generated rule) to call `neuron_context` **before** broad repository
exploration, then open the returned paths. Neuron accelerates; source files remain the authority.

### Inspect what the AI would see

```bash
neuron context "Where should I add a payment endpoint?"
```

```text
Project Brain
────────────────────────

Recommended:
  src/billing/service.ts

Because:
  Service / business logic; belongs to the billing module

Related:
  src/billing/
  src/api/routes/index.ts

Relevant:
  src/billing/
  src/billing/stripe.ts
  src/services/payment-service.ts

Rules:
  Never call the payment provider directly from route handlers

Context:
  182 tokens
Project corpus:
  2143 tokens
Estimated project context avoided:
  ~1.9k tokens (vs whole-brain paste)
Compression:
  91%
Retrieval:
  8 ms · MODIFICATION
```

`estimatedTokensSaved` compares the compiled context to pasting the whole Project Brain
(`baseline: whole-brain-verbatim`). It is not a claim about the model's full session bill.

## How the Project Brain works

```text
codebase ──scan──▶ .neuron/brain/ ──retrieve──▶ compile ──MCP──▶ Cursor
                        ▲                                          │
                        └────────── ask before remembering ◀───────┘
```

**Project DNA** — what the project *is*: language, framework, database, module layout, entry
points. Detected from manifests and structure, each claim carrying a confidence and its evidence.

**Knowledge** — what the project has *decided*: architecture decisions, patterns, constraints,
warnings. Seeded from your README, code structure and Git history, then grown as you work.
The same plane also holds the **project map** (where things live) and **code intelligence**
(exported symbols and verified relationships — imports, calls, routes — each with evidence and
confidence). Neuron prefers a missing edge over a wrong one.

**Retrieval** — deterministic BM25-style lexical ranking over memories, map locations, and code
symbols. When evidence exists, context expansion follows high-confidence edges so the agent gets
a connected slice (start → related → dependency → flow), not a random file list.

Relevance is a **gate**, not one term in a weighted sum. Importance and freshness are applied
multiplicatively, so they reorder memories that already match your task but can never promote an
unrelated one. If nothing matches, Neuron says so instead of returning its most important memory.

**Brain Compression** — the brain can be large; the context sent to the model is small. One
markdown document, packed against a hard token budget, dropping the least valuable section first:
patterns before constraints, constraints before decisions, decisions before warnings.

| Mode | Budget | For |
| --- | --- | --- |
| `minimal` (default) | 500 tokens | everyday coding |
| `standard` | 1200 tokens | multi-file features |
| `deep` | 3500 tokens | architecture and refactors |

## Local-first, and it is tested

| | |
| --- | --- |
| Cloud services | none |
| API keys | none |
| Database | none — plain JSON files |
| Telemetry | none, not even opt-in |
| Network calls at runtime | none |

This is checked, not just asserted. `pnpm verify:offline` runs the whole journey — init, scan,
search, doctor — with outbound sockets, DNS and `fetch` disabled. Any network attempt throws.

## Install

```bash
npm install -g neuronai
```

Node.js 22+. Or without installing:

```bash
npx neuronai init
```

One package, one dependency. Nothing to configure.

## Quick start

```bash
cd your-project
neuron init
```

Init detects the project, reads the codebase, writes the brain, and wires Cursor. It asks two
questions — or none with `--yes`. Real output from a Next.js + PostgreSQL app:

```text
[5/8] Initial scan…
✓ Mapped 5 modules across 15 files
✓ Learned 21 things about this project
[6/8] Brain creation…
✓ Project Brain written (.neuron/brain/ + prefs.json)
[7/8] Cursor integration…
✓ Created Cursor rules + MCP (.cursor/)

What Neuron learned

Project: acme-shop

Detected
  Language        typescript
  Framework       nextjs
  Database        postgresql
  Package manager npm
  Git repository  yes
  Modules         5 (auth, billing, api, services, repositories)
  Files read      15

Brain
  21 memories
  1 architecture decisions
  4 conventions (suggested — review them)
  Architecture confidence 87%

Cursor
  MCP server      registered in .cursor/mcp.json
  Agent rules     installed
```

It tells you what it *could not* work out too, so you are never guessing what it knows.

## Connect Cursor

`neuron init` writes `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "neuron": {
      "command": "npx",
      "args": ["-y", "neuronai", "mcp"]
    }
  }
}
```

Then **Cursor Settings → Tools & MCP → enable "neuron"**. Cursor keeps MCP servers off until you
turn them on. Check the wiring any time:

```bash
neuron cursor     # connection status and next steps
neuron doctor     # full diagnostic, every warning has a fix
```

## A real example

Ask the terminal what the project knows:

```text
$ neuron search "how does billing work"

[ 78%] Billing runs through Stripe webhooks
    Billing runs through Stripe webhooks; we never store card data.
    knowledge · matched bill · in title · 100% of task terms
```

And this is the whole context the agent receives for a task — no JSON twin, no ranking metadata,
no memory ids:

```markdown
# Task
change the memory consent UX

## Decisions
- Ask-before-remember UX: autoSave true with Yes/No consent
- Project uses modular architecture — Detected modules: cli, mcp-server, brain, storage…
```

101 tokens selected from a 784-token brain. The licensing decision, the persistence decision and
the auth pattern were all correctly left out.

## Ask before remembering

Neuron never writes a memory you did not approve. After a change the agent proposes a draft and
asks:

> I learned something about your project.
> **Auth lives behind JWT middleware** — all authentication runs through JWT middleware,
> never inline in route handlers.
> **Yes** · **Edit** · **No**

Same flow from the terminal:

```bash
neuron remember "Rate limiting belongs in middleware, not individual handlers"
```

## Honest metrics

```bash
neuron brain
```

Every number is labelled **measured** (counted from disk), **derived** (computed from counted
values) or **estimated** (a labelled heuristic). Token counts use a chars/4 approximation and say
so. Compression figures appear only after a real compilation has produced them — nothing is
presented as a saving that was not measured.

Keep these separate forever:

| Label | Meaning |
| --- | --- |
| **Brain compression** (MEASURED) | Whole brain → compiled `neuron_context` |
| **Exploration policy** (SIMULATED) | Scripted baseline vs Neuron file/grep ops |
| **Live agent proof** | Real Cursor/LLM tool traces — currently **UNAVAILABLE** without API keys |

Never call Brain compression “agent token savings.” Never call the scripted exploration harness a
live-agent result.

## Performance

Measured on this machine, cold, single-threaded:

| Project | Files | `init` | `scan` | `scan --update` | search | context |
| --- | --- | --- | --- | --- | --- | --- |
| small | 14 | 101 ms | 78 ms | 2 ms | 0.21 ms | 0.23 ms |
| medium | 242 | 160 ms | 144 ms | 25 ms | 0.08 ms | 0.13 ms |
| large | 1,842 | 557 ms | 587 ms | 163 ms | 0.09 ms | 0.13 ms |

`--update` skips re-analysis when nothing changed. The brain for a 1,842-file project is 11 KB.

## Commands

| Command | What it does |
| --- | --- |
| `neuron init` | Detect the project, build the brain, wire Cursor |
| `neuron scan` | Re-learn from the codebase (`--deep`, `--update`) |
| `neuron search <query>` | Search what the project knows |
| `neuron remember <text>` | Add something yourself |
| `neuron brain` | Metrics: measured, derived, estimated |
| `neuron status` | Project and memory overview |
| `neuron cursor` | Cursor connection status and next steps |
| `neuron doctor` | Diagnose the brain, storage and Cursor setup |
| `neuron reset --force` | Delete the local brain |
| `neuron mcp` | Run the MCP server (Cursor calls this for you) |

## What is on disk

```text
.neuron/
├── prefs.json            # your init answers                 (commit)
├── brain/
│   ├── dna.json          # stack, modules, structure         (commit)
│   ├── knowledge.json    # memories, decisions, rules, graph (commit)
│   └── health.json       # derived health score              (commit)
├── runtime/store.json    # regenerable engine store          (ignored)
└── cache/                # scan cache                        (ignored)
```

Commit `.neuron/brain/` and your team shares one project memory. `neuron init` writes the
matching `.gitignore` block. Delete the folder and NeuronAI is gone — nothing else is touched.

Writes go through a temp file and `rename`, so an interrupted write cannot corrupt the brain.

## MCP tools

Seven tools, one job each. Full reference in [`docs/mcp.md`](https://github.com/tokpl/neuronai/blob/main/docs/mcp.md).

| Tool | Purpose |
| --- | --- |
| `neuron_context` | Ranked, compressed project knowledge for a task |
| `neuron_search` | Keyword search over memories |
| `neuron_remember` | Store a decision, pattern, warning or fact |
| `neuron_update` | Change a memory (versioned) |
| `neuron_after_task` | Propose what to remember after coding |
| `neuron_resolve_suggestion` | Apply the user's Yes / Edit / No |
| `neuron_scan` | Rebuild the brain from the codebase |

## Architecture

```text
apps/cli          the neuron binary (bundled, self-contained)
apps/mcp-server   MCP server over stdio
packages/brain    ProjectBrain, retrieval, compiler, dedupe
packages/storage  the one runtime construction path
packages/*        scanner, config, types, Cursor integration
```

`ProjectBrain` owns persistence and lifecycle. Retrieval owns relevance. The compiler owns shape.
The scanner owns project analysis. The CLI and MCP server are adapters and build the runtime the
same way, through `createNeuronRuntime()`.

More: [How it works](https://github.com/tokpl/neuronai/blob/main/docs/how-it-works.md) · [`.neuron/` folder](https://github.com/tokpl/neuronai/blob/main/docs/neuron-folder.md) ·
[FAQ](https://github.com/tokpl/neuronai/blob/main/docs/faq.md) · [Privacy](https://github.com/tokpl/neuronai/blob/main/docs/privacy.md) ·
[Production readiness](https://github.com/tokpl/neuronai/blob/main/docs/PRODUCTION_READINESS.md) ·
[Daily-use product](https://github.com/tokpl/neuronai/blob/main/docs/DAILY_USE_PRODUCT.md) ·
[P4 validation](https://github.com/tokpl/neuronai/blob/main/docs/P4_PRODUCT_VALIDATION.md)

## Contributing

```bash
pnpm install
pnpm verify   # lint, typecheck, test, build, package + offline checks
```

`pnpm verify` is the gate. It must pass before a change lands — there is no CI to catch it later.

See [CONTRIBUTING](https://github.com/tokpl/neuronai/blob/main/CONTRIBUTING.md). Bugs and ideas:
[open an issue](https://github.com/tokpl/neuronai/issues).

## License

[AGPL-3.0](https://github.com/tokpl/neuronai/blob/main/LICENSE). The name and logo are covered separately by [TRADEMARK](https://github.com/tokpl/neuronai/blob/main/TRADEMARK.md).
Security policy: [SECURITY](https://github.com/tokpl/neuronai/blob/main/SECURITY.md).

<p align="center">
  <a href="https://github.com/tokpl/neuronai">github.com/tokpl/neuronai</a>
</p>

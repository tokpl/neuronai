# Changelog

## 0.2.2

- Fix: `neuron -v` now reports the real package version (was stuck on `0.2.0` because
  `CLI_VERSION` was hardcoded and not updated with `package.json`)
- CLI version is generated from `apps/cli/package.json` at bundle time so it cannot drift again
- `pnpm prepare:npm <version>` bumps all workspace manifests + MCP `VERSION`

## 0.2.1

Ask-before-remember UX and proactive Project Brain capture for Cursor agents.

### Remember confirmation

- Proposed durable memory is shown **before** Yes / Edit / No (`question.prompt` embeds the draft)
- Drafts are synthesized as concise project knowledge (decision / canonical / replaces / why), not changelogs or file lists
- AskQuestion-first presentation: `question.title` is `🧠 Project Brain`; MCP returns `present.prefer: "AskQuestion"`
- Edit rewrites the proposed memory text, not the implementation

### Proactive after-coding

- Cursor rules mark **After coding (required)** with explicit triggers (done / zaimplementowane / ADR / new ownership)
- `neuron_context` returns `afterCoding` so agents close the remember loop without waiting for the user to ask
- Fixed a `euron_*` typo in the workflow rule that could break tool naming

After upgrading: **reload Cursor MCP** so the IDE picks up the new tool descriptions and templates.

## 0.2.0

Retrieval rewrite plus a productization pass. **`neuronai` is now a single self-contained
package** — installing it no longer pulls a dozen `@neuronai/*` packages that had to exist at
matching versions. The workspace libraries are private and bundled into the CLI.

Upgrading from 0.1.x: run `neuron scan` once. The brain layout migrates automatically.
After upgrading, **reload Cursor MCP** (Settings → Tools & MCP → toggle neuron, or Reload Window)
so the IDE tool catalog matches the 7-tool surface.

### Packaging

- One published package with one dependency (`@modelcontextprotocol/sdk`)
- `pnpm verify:package` installs the tarball into a clean project and fails if any
  `@neuronai/*` package is resolved from the registry
- `pnpm verify:offline` runs init, scan, search and doctor with sockets and DNS disabled
- `pnpm verify` chains lint, typecheck, test, build and both of the above — the release gate

### Cursor MCP

- Product surface is **exactly 7 tools**, primary entry `neuron_context`
- Legacy names (`neuron_prepare_task`, `neuron_get_context`, …) are gone from the binary
- `neuron cursor doctor` distinguishes stdio catalog vs IDE catalog / reload guidance
- Live Cursor Task A/B (hard tool traces, n=20×2 on one repo): agents that call
  `neuron_context` first showed lower exploration/file-read medians with task success held.
  Token/latency savings are **not** claimed.

### Product

- `neuron cursor` — connection status and next steps (previously "Unknown command")
- `neuron remember "..."` — ask-before-remember from the terminal
- `neuron init` reports what it detected *and what it could not determine*
- `neuron doctor` gained brain-freshness and end-to-end retrieval checks
- Removed `neuron build` (a duplicate of `scan`) and the `cursor init` alias
- `neuron --help` no longer prints two help screens

### Scan quality

- `src/<module>/` layouts are detected — conventional projects reported zero modules before
- Inferred conventions become searchable memories instead of only reaching `constitution.md`
- Layer locations are recorded, so "where are API routes defined?" has an answer
- README bullets become individual memories rather than being folded into one blob
- `scan --update` skips re-analysis when nothing changed: 163 ms vs 587 ms on 1,842 files

### Removed

- `providers`, `server.mode`, `server.bind` and `security` from the config schema — nothing read
  them, and they advertised cloud, LLM providers and an HTTP server that do not exist
- `DATABASE_URL` and `OPENAI_API_KEY` from `.env.example`
- The last `NotImplementedError` in a production path

## 0.1.5 (unreleased, folded into 0.2.0)

Retrieval rewrite. The previous ranking used a 32-dimensional character-hash "embedding" as its
largest term, which meant relevance was mostly noise and the same few high-importance memories
came back for almost every task.

- **Deterministic lexical retrieval** replaces the hash-embedding hybrid: BM25-style term
  matching with light stemming, exact-phrase and title boosts, and a coverage reward. Relevance
  is now a gate — importance and freshness apply multiplicatively and can never promote an
  unrelated memory above a relevant one. Memories sharing no subject term are excluded outright.
- **One canonical context.** `neuron_context` returns a single markdown document instead of
  `briefing` + `markdown` + `decisions` + `plan` + `recommendations` carrying the same titles up
  to eight times. Token budgets are now enforced, not advisory: 500 / 1200 / 3500.
- **Content-level deduplication** on write and on load. Re-saving known knowledge merges into the
  existing memory, keeping the richest content, the union of tags and the strongest scores.
- **One runtime construction path** (`createNeuronRuntime`) shared by the CLI and the MCP server.
- **MCP surface reduced from 13 tools to 7**: `neuron_context`, `neuron_search`,
  `neuron_remember`, `neuron_update`, `neuron_after_task`, `neuron_resolve_suggestion`,
  `neuron_scan`.
- **Scan results now reach memory.** Generated observations went to `scan-memories.json`, which
  nothing read; they are now stored, deduplicated and searchable, and modules populate DNA.
- Removed the `goals` and `active` brain planes, which were written on every save but never
  populated or read. They are deleted on open.
- Removed fabricated metrics (`est_tokens_saved`, `est_time_saved_hours` and friends). Brain
  metrics now report only measured, derived, or clearly-labeled estimated values, plus real
  compression numbers once a context has been compiled.
- Brain writes are atomic (temp file plus rename).
- Removed 8 packages with no reachable consumers, including an OpenAI embeddings client that
  contradicted the zero-cloud, zero-API-key promise.

## 0.1.4

- **@neuronai/brain** (new): Project Brain runtime — DNA, knowledge, health, goals, metrics
- **Brain Compression Engine**: `neuron_prepare_task` / `get_context` return a single budgeted prompt (minimal / standard / deep), not the raw Brain
- Plans and risks only in **deep** mode; verbose internals only with `mode=debug` or `NEURON_DEBUG=1`
- Compression metrics (searched / selected / discarded / prompt tokens / prep time)
- Learning UX and Brain Metrics CLI (`neuron brain`)

## 0.1.3

- Patch release of the NeuronAI monorepo packages

## 0.1.0

First public release of **neuronai**.

- `npx neuronai init` / `npm i -g neuronai` / `neuron init`
- Local `.neuron/` storage
- MCP tools for Cursor
- No Docker, Postgres, or API keys required

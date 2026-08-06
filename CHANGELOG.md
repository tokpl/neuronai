# Changelog

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
- 12 MCP tools for Cursor
- No Docker, Postgres, or API keys required

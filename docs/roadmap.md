# Roadmap

NeuronAI stays local-first. No cloud service, no accounts, no hosted sync is planned — Git is
the sharing mechanism and that is deliberate, not a placeholder for something else.

## Shipped

- Project Brain in `.neuron/` — DNA, knowledge, decisions, conventions, health
- Deterministic lexical retrieval with a relevance gate
- Brain Compression with enforced token budgets (500 / 1200 / 3500)
- Ask-before-remember, in Cursor and in the terminal
- Content-level deduplication on write
- Seven MCP tools, one self-contained npm package
- Incremental scanning
- Workflow suite — prime / deliver / blueprint / polish / chronicle / craft / maintain
- MCP `present.clarify` / `present.gate` on `neuron_context` (Brain-enforced ask)
- `neuron prime` CLI + doctor primed + memory-decay advisory
- Organic `present.callFirst` + `neuron_resolve_clarify` + `neuron_workflow` (9-tool MCP)
- Per-memory markdown mirrors under `.neuron/memory/`
- Python/Go symbol hints in scan + `neuron decay --fix`

## Being considered

- **More editors** — the MCP server already works anywhere MCP does; adapters for other hosts
  would make setup as smooth as it is in Cursor
- **Live agent A/B** — see [LIVE_AGENT_PROOF.md](./LIVE_AGENT_PROOF.md) when API keys exist
- **Optional local embeddings** — a bundled model layered on top of lexical ranking, still with
  no network and no API key

## Not planned

Cloud sync, hosted brains, accounts, teams-as-a-service, telemetry, an agent framework, a
database backend, or a plugin system.

If you want a shared brain, commit `.neuron/brain/`. That is the whole feature.

[github.com/tokpl/neuronai](https://github.com/tokpl/neuronai)

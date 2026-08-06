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

## Being considered

- **Per-memory files** — `.neuron/memory/*.md` instead of one JSON array, so team brains merge
  cleanly and knowledge changes show up as reviewable diffs in pull requests
- **More editors** — the MCP server already works anywhere MCP does; adapters for other hosts
  would make setup as smooth as it is in Cursor
- **Memory decay** — flagging knowledge whose referenced files no longer exist
- **Optional local embeddings** — a bundled model layered on top of lexical ranking, still with
  no network and no API key

## Not planned

Cloud sync, hosted brains, accounts, teams-as-a-service, telemetry, an agent framework, a
database backend, or a plugin system.

If you want a shared brain, commit `.neuron/brain/`. That is the whole feature.

[github.com/tokpl/neuronai](https://github.com/tokpl/neuronai)

# FAQ

### Does Neuron need Postgres or Docker?

No. Default storage is the filesystem under `.neuron/`.

### Do I need an OpenAI / Anthropic API key?

No. Neuron provides knowledge; Cursor’s model answers. Local hash embeddings power search.

### How does the team share memory?

Commit `.neuron/*.json` (not cache/runtime). `git pull` is Team Brain for MVP.

### Is Neuron an AI agent?

No. It is local project memory for AI IDEs (Cursor first).

### Why only 12 MCP tools?

So developers get a clear daily loop — not an enterprise catalog.

### Can I use Postgres later?

Yes — archived under `future/packages/storage-postgres`. Not part of MVP.

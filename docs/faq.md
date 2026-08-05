# FAQ

**NeuronAI** is the package / product name. **Neuron - AI Memory** is the product title.

**Does NeuronAI need Postgres or Docker?**  
No. Storage is `.neuron/` on disk.

**Do I need an OpenAI / Anthropic API key?**  
No. NeuronAI provides knowledge; Cursor's model answers.

**How does the team share memory?**  
Commit `.neuron/*.json`. `git pull` is Team Brain.

**Is NeuronAI an AI agent?**  
No. Local project memory for Cursor (Neuron - AI Memory).

**Install commands?**

```bash
npx neuronai init
npm install -g neuronai
neuron init
```

**VS Code extension?**  
No. Cursor-first.

**MCP shows Error / `'neuron' is not recognized`?**  
1. Re-run `neuron cursor setup --force` (writes `npx`/`node` instead of a bare `neuron` binary).  
2. In Cursor: **Settings → Tools & MCP → neuron → Enable**.  
3. Reload the window if the status stays red.

**What is published to npm?**  
`neuronai` (CLI) and `@neuronai/*` libraries. See [`PUBLISH.md`](./PUBLISH.md).

https://github.com/tokpl/neuronai

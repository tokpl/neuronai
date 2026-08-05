# FAQ

**Does neuronai need Postgres or Docker?**  
No. Storage is `.neuron/` on disk.

**Do I need an OpenAI / Anthropic API key?**  
No. neuronai provides knowledge; Cursor's model answers.

**How does the team share memory?**  
Commit `.neuron/*.json`. `git pull` is Team Brain.

**Is neuronai an AI agent?**  
No. Local project memory for Cursor.

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

https://github.com/tokpl/neuronai

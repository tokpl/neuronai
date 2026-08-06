# FAQ

**NeuronAI** is the package / product name. **Neuron - AI Memory** is the product title.

**Does NeuronAI need Postgres or Docker?**  
No. Storage is `.neuron/` on disk.

**Do I need an OpenAI / Anthropic API key?**  
No. NeuronAI provides knowledge; Cursor's model answers.

**How does the team share memory?**  
Commit `.neuron/*.json`. `git pull` is Team Brain.

**What does `memory.autoSave` mean?**  
`true` means Neuron is allowed to offer (or auto-write) durable knowledge. With the default *ask* mode it still asks *“Should I remember this?”* before writing. Set `privacy.mode` to `automatic` for silent high-confidence saves, or `manual` to never offer.

**What is `contextMaxTokens`?**  
How much ranked project memory (in tokens) Neuron may inject into one agent turn (`prepare_task` / `get_context`). Default **3000**. Higher = more memory in context, lower = leaner prompts. Optional — omit it and the default applies.

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
`neuronai` (CLI) and `@neuronai/*` libraries under the **neuronai** org.

https://github.com/tokpl/neuronai

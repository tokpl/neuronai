# FAQ

**Does NeuronAI need Postgres, Docker or any database?**
No. The brain is JSON files in `.neuron/` inside your project.

**Do I need an OpenAI or Anthropic API key?**
No. Neuron supplies project knowledge; your editor's model writes the code. There is no AI
provider in the runtime and no place to put a key.

**Does anything leave my machine?**
No. There is no HTTP client in the runtime. `pnpm verify:offline` proves it by running the full
journey with sockets and DNS disabled — you can run that against a clone yourself.

**Is NeuronAI an agent?**
No. It is memory. It retrieves and compresses what your project already knows and hands it to
whatever agent you use.

**How does a team share memory?**
Commit `.neuron/brain/` and `prefs.json`. Teammates get the same decisions and conventions on
`git pull`. Choose the `all-local` preset during `neuron init` to keep it to yourself.

**What does `memory.autoSave` mean?**
Whether agents may propose memories. With the default `suggest` privacy mode Neuron always
confirms with **Yes / Edit / No** before writing. Set `privacy.mode` to `automatic` for silent
high-confidence saves, or `manual` to never propose.

**How big is the context Neuron sends?**
500 tokens by default, 1200 in `standard`, 3500 in `deep`. These are hard budgets, not targets —
the compiler packs against them and drops the least valuable section first.

**Why did search return nothing?**
Because nothing in the brain matched. Neuron returns no results rather than its most important
memory. Add the knowledge with `neuron remember "..."` or re-scan with `neuron scan`.

**Cursor shows Error, or `'neuron' is not recognized`**

1. `neuron cursor setup --force` — rewrites the config to use `npx`
2. Cursor **Settings → Tools & MCP → neuron → Enable**
3. Reload the window if the status stays red
4. `neuron cursor` shows the current state any time

**Is there a VS Code extension?**
Not yet. Cursor first. Any MCP-capable editor can use the server via `neuron mcp`.

**What is published to npm?**
One package: `neuronai`. It is self-contained — the workspace libraries are bundled in, not
published separately, so there are no version-skew failures.

**How do I remove it?**

```bash
neuron reset --force   # deletes .neuron/
npm uninstall -g neuronai
```

Nothing is written outside your project directory.

[github.com/tokpl/neuronai](https://github.com/tokpl/neuronai)

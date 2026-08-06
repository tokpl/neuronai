# Getting started

Five minutes from install to an agent that knows your project.

## 1. Install

```bash
npm install -g neuronai
```

Node.js 22 or newer. Or run it once without installing:

```bash
npx neuronai init
```

`neuron` and `neuronai` are the same command.

## 2. Build the brain

```bash
cd your-project
neuron init
```

Init detects the language, framework, database, package manager and module layout, reads your
README and Git history, and writes the brain to `.neuron/`. It asks two questions:

- **How should Neuron remember knowledge?** — ask first (default), automatic, or manual
- **Update `.gitignore`?** — keeps the brain shareable while ignoring regenerable files

Add `--yes` to accept both defaults and skip the prompts.

When it finishes it prints what it learned *and what it could not determine*, so you know exactly
where you stand.

## 3. Connect Cursor

`neuron init` already wrote `.cursor/mcp.json`. Cursor keeps MCP servers off until you turn
them on:

1. Open the project in Cursor
2. **Cursor Settings → Tools & MCP**
3. Find **neuron** and enable it
4. Wait for the status to turn green

```bash
neuron cursor    # shows the connection status and what is left to do
```

If Cursor reports `'neuron' is not recognized`, re-run setup so MCP invokes `npx` rather than a
bare binary:

```bash
neuron cursor setup --force
```

## 4. Check it works

```bash
neuron doctor
```

Every check either passes or tells you the exact command that fixes it.

Then ask it something real:

```bash
neuron context "Where are API routes and authentication handled?"
neuron search "how does authentication work"
```

`neuron context` shows the same budgeted project knowledge Cursor would receive — paths, rules,
and architecture, not the whole repository.

In Cursor, just describe a task — the agent calls `neuron_context` on its own and follows the
locations, decisions and warnings it gets back.

## 5. Keep it current

```bash
neuron scan            # re-learn from the codebase
neuron scan --update   # only what changed since last time
```

Add knowledge the code cannot express:

```bash
neuron remember "Rate limiting belongs in middleware, not individual handlers"
```

## Removing it

```bash
neuron reset --force
npm uninstall -g neuronai
```

No Docker. No database. No API keys. Nothing outside your project directory.

Next: [How it works](./how-it-works.md) · [MCP tools](./mcp.md) · [FAQ](./faq.md)

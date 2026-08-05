# Getting started

## Install

```bash
npm install -g neuronai
```

Or one-shot:

```bash
npx neuronai init
```

## Init

```bash
cd your-project
neuron init
```

(`neuron` and `neuronai` are the same CLI.)

## Use in Cursor

1. Open the project in Cursor
2. Open **Cursor Settings → Tools & MCP**
3. Find **neuron** and toggle **Enable** (MCP servers stay off until you enable them)
4. Wait until the status is green (not Error)
5. Ask: `Prepare adding X using neuronai`

If Cursor shows `'neuron' is not recognized`, re-run setup so MCP uses `npx`/`node` instead of a bare `neuron` binary:

```bash
neuron cursor setup --force
# or: npx neuronai cursor setup --force
```

## Verify

```bash
neuron doctor
neuron status
neuron search architecture
```

No Docker. No Postgres. No API keys.

https://github.com/tokpl/neuronai

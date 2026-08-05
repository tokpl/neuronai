# Getting started

Neuron is **local-first project memory** for Cursor.

## Install

```bash
npm install -g neuron
```

(From this monorepo during development: `pnpm build && pnpm neuron …`)

## Init

```bash
cd your-project
neuron init
```

This creates `.neuron/`, scans the codebase, and wires `.cursor/mcp.json`.

## Use in Cursor

1. Open the project in Cursor
2. Reload MCP / enable the `neuron` server
3. Ask Cursor to prepare a task with Neuron

Example:

> Prepare adding rate limiting using Neuron

## Verify

```bash
neuron doctor
neuron cursor doctor
neuron status
```

## Requirements

- Node.js 22+
- Cursor
- **No** Docker, Postgres, or API keys for the default loop

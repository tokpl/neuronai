# Cursor example

## Goal

Use Neuron as an MCP memory backend inside Cursor.

## Steps

1. From the monorepo root:

```bash
pnpm install && pnpm build
pnpm neuron init
pnpm neuron cursor setup
```

2. Ensure Cursor MCP config points at Neuron (the setup command writes under `.neuron/integrations/cursor/`).

3. In chat, try:

> Use neuron_prepare_task for adding rate limiting to the API.

4. After decisions:

> Save this decision with neuron_save_decision: we use Redis for rate limits.

## Verify

```bash
pnpm neuron search "rate limit"
pnpm neuron status
```

# Troubleshooting

## `neuron init` says already initialized

Use `neuron init --force` or `neuron analyze`.

## MCP server not visible in Cursor

1. `neuron cursor setup`
2. Restart Cursor / reload MCP
3. Ensure `neuron` is on `PATH` (`pnpm build` + link) or use the monorepo `tsx` fallback in docs

## Empty search results

Run `neuron analyze` / seed memories. Confirm `.neuron/data/store.json` exists (`neuron doctor`).

## Doctor fails on MCP

`.cursor/mcp.json` missing `neuron` entry → `neuron cursor setup`.

## Postgres connection errors

Local mode does not require Postgres. If `DATABASE_URL` is set, ensure `pnpm docker:up` and migrations.

## Slow first MCP start

Knowledge graph bootstrap walks the repo once. Subsequent starts reuse `.neuron/data/graph.json`.

## Accidentally deleted memories

Restore from `neuron backup` snapshot: `neuron restore path/to/brain.json`.

# Neuron development skill

## Goal

Help contributors work inside the Neuron AI Memory monorepo without breaking package boundaries.

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:up
pnpm neuron status
pnpm dev:mcp
```

## Layout reminders

- `apps/mcp-server` — MCP transport + tools
- `apps/cli` — `neuron` CLI
- `packages/types` — shared types + errors
- `packages/config` — Zod config
- `packages/storage` — Postgres adapter (schema in M1)
- `packages/memory-engine` — domain engine (logic in M1+)

## When unsure

Prefer stubs + `NotImplementedError` over premature business logic.

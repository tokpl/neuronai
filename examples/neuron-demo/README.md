# Neuron Demo — ShopLite

A tiny full-stack shop used to showcase **Cursor + Neuron**.

Not a production app. Structure is intentional so agents have something real to remember.

## Layout

```text
apps/
  web/          # frontend (static + fetch to API)
  api/          # backend (Express-style modules)
packages/
  db/           # database access layer (only place for SQL)
  domain/       # shared types / transaction helpers
```

## Seeded architecture decisions

See `.neuron/decisions.md`:

1. Payments are **event-driven** (outbox) — HTTP never writes the ledger directly
2. Controllers **must not** open DB connections — use `packages/db`
3. Orders and payments share a **transaction pattern** in `packages/domain`

## Without Neuron

Prompt: *“Add payment system”*

Typical agent: invents new DB access in controllers, maybe a second ORM, ignores outbox.

## With Neuron

```text
neuron_prepare_task("Add payment system")
```

Expected briefing themes:

- Architecture: follow existing transaction pattern
- Warnings: do not access database directly from HTTP
- Decisions: payments use event-driven flow

## Try it

```bash
# from monorepo root
pnpm build
cd examples/neuron-demo
pnpm --dir ../.. neuron init cursor --force
pnpm --dir ../.. neuron cursor doctor
```

Open this folder in Cursor → enable MCP **neuron** → follow [docs/demo/03-first-task.md](../../docs/demo/03-first-task.md).

## Before / after

See [BEFORE_AFTER.md](./BEFORE_AFTER.md).

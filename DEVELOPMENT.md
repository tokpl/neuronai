# Development

Neuron is a **pnpm + Turborepo** TypeScript monorepo.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Requirements: **Node.js 22+**, **pnpm 9**.

No Docker. No Postgres. No API keys for the default loop.

## Useful commands

| Command | Purpose |
|---------|---------|
| `pnpm neuron …` | Run CLI from monorepo |
| `pnpm dev:mcp` | MCP server (stdio) |
| `pnpm lint` / `typecheck` / `test` / `build` | Quality gate |

## Layout

```text
apps/cli            # `neuron` binary
apps/mcp-server     # MCP transport + 12 tools
packages/*          # MVP core
future/packages/*   # Non-MVP (not in workspace build)
examples/neuron-demo
docs/               # Thin honest docs
```

## Product rule

Before adding a feature ask:

> Does this help Cursor understand the user's project?

If no — put it in `future/` or drop it.

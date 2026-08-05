# Development

Contributor setup for the Neuron monorepo.

## Prerequisites

- Node.js **22+**
- pnpm **9.15+** (`corepack enable`)
- Optional: Docker for Postgres + pgvector

## Setup

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm test
pnpm lint
```

Optional database:

```bash
pnpm docker:up
pnpm db:migrate
```

## Useful commands

| Command | Purpose |
|---------|---------|
| `pnpm neuron <cmd>` | Run built CLI |
| `pnpm neuron init cursor` | Full Cursor bootstrap |
| `pnpm neuron cursor doctor` | Validate Cursor wiring |
| `pnpm dev:mcp` | MCP watch mode |
| `pnpm docker:prod` | Experimental prod compose |

## Package map

See [docs/architecture-guide.md](./docs/architecture-guide.md) and [docs/development-guide.md](./docs/development-guide.md).

## Quality bar

- Conventional commits (`feat`, `fix`, `docs`, …)
- Tests for behavior changes
- No secrets in commits or logs
- MCP handlers stay thin

## Public demo

[`examples/neuron-demo`](./examples/neuron-demo) — use when recording [docs/demo/](./docs/demo/) scripts.

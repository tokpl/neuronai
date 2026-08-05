# Development guide

## Setup

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm test
pnpm lint
```

Optional Postgres: `pnpm docker:up` then `pnpm db:migrate`.

## Workspace layout

- `apps/cli` — `neuron` binary (publish name: `neuron-ai-memory`)
- `apps/mcp-server` — MCP stdio server
- `packages/*` — domain libraries (memory, graph, intelligence, ops, security, …)

See [architecture-guide.md](./architecture-guide.md).

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm neuron <cmd>` | Run built CLI |
| `pnpm dev:mcp` | MCP in watch mode |
| `pnpm docker:up` | Dev Postgres |
| `docker compose -f docker/docker-compose.prod.yml up --build` | Prod-ish stack |

## Quality bar

- Conventional commits
- Tests for behavior changes
- No secrets in logs or commits
- MCP handlers remain thin

## Good first issues

[good-first-issues.md](./good-first-issues.md)

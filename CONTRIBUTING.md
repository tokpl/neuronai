# Contributing to Neuron AI Memory

Thanks for helping build a durable memory layer for AI coding agents.

## Development setup

See **[DEVELOPMENT.md](./DEVELOPMENT.md)** for the short path.

1. Install **Node.js 22+** and enable **pnpm** (`npm i -g pnpm@9`).
2. `pnpm install`
3. `cp .env.example .env`
4. `pnpm docker:up` (optional Postgres + pgvector)
5. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

## Project conventions

- **TypeScript strict** across the monorepo.
- Prefer small packages with clear boundaries (`types` / `config` / `storage` / `memory-engine` / apps).
- Do **not** store raw chat transcripts as memories — knowledge only.
- Public APIs belong in package `src/index.ts`; keep internals private.
- Use `NeuronError` subclasses from `@neuron-ai-memory/types` for failure modes.

## Pull requests

- Keep PRs focused and reviewable.
- Include tests for new behavior.
- Run the full quality gate locally before opening a PR.
- Use conventional commits when possible: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Architecture

See [docs/architecture-guide.md](./docs/architecture-guide.md) and [docs/development-guide.md](./docs/development-guide.md).

Starter tasks: [docs/good-first-issues.md](./docs/good-first-issues.md).

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](./SECURITY.md).

## Support

See [SUPPORT.md](./SUPPORT.md).

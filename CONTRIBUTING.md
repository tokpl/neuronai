# Contributing to Neuron

Thanks for helping build local-first project memory for AI IDEs.

## Development setup

1. Install **Node.js 22+** and **pnpm 9**
2. `pnpm install`
3. `pnpm build && pnpm test`
4. Optional: `cp .env.example .env` (nothing required for local MVP)

No Docker or Postgres needed.

## Project conventions

- TypeScript strict across the monorepo
- Prefer small packages with clear boundaries
- Do **not** store raw chat transcripts — knowledge only
- Public APIs in package `src/index.ts`
- Use `NeuronError` from `@neuron-ai-memory/types`
- Filter every feature: *Does this help Cursor understand the user's project?*

## Pull requests

- Keep PRs focused
- Include tests for new behavior
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`

## Architecture

- MVP docs: [docs/how-it-works.md](./docs/how-it-works.md), [docs/mvp.md](./docs/mvp.md)
- Non-MVP code: [`future/`](./future/README.md)

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](./SECURITY.md). Report vulnerabilities privately — do not open public issues for secrets.

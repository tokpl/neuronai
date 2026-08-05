# Contributing to NeuronAI

Thanks for helping improve **NeuronAI** (**Neuron - AI Memory**) — local-first project memory for Cursor.

By contributing, you agree that your contributions are licensed under the [GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0), unless you state otherwise in writing. There is **no CLA**. See also [TRADEMARK.md](./TRADEMARK.md) (code ≠ brand).

## Ground rules

- Prefer changes that help Cursor understand a **real project** (memory, MCP, scan, DX)
- Do **not** add enterprise/cloud product surfaces to the OSS core by default
- No secrets, tokens, or private project data in PRs
- Be respectful — [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Development setup

Requirements: **Node.js ≥ 22**, **pnpm 9** (see `packageManager` in root `package.json`).

```bash
git clone https://github.com/tokpl/neuronai.git
cd neuronai
pnpm install
pnpm build
pnpm test
```

Useful scripts:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm neuron -- status          # local CLI via monorepo
# or after global install:
# npm install -g neuronai && neuron status
```

Published npm package: **`neuronai`** (from `apps/cli`), plus scoped `@neuronai/*` libraries.

## Issues

1. Search existing issues first
2. Use the issue templates under **New issue**
3. For vulnerabilities, follow [SECURITY.md](./SECURITY.md) — **do not** file a public bug with exploit details

Good bug reports include: NeuronAI version (`neuron --version`), OS, minimal repro, and redacted logs.

## Pull requests

1. Fork and create a branch from `main`
2. Keep PRs focused (one concern per PR when practical)
3. Add/update tests when behavior changes
4. Run before opening the PR:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

5. Fill in the PR template (summary, type, checklist)

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new user-facing capability
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` no intended behavior change
- `test:` tests only
- `chore:` tooling, deps, repo hygiene

Examples: `fix: route MCP logs to stderr`, `docs: add trademark policy`.

## Project layout (short)

| Path | Role |
|------|------|
| `apps/cli` | `neuron` / `neuronai` CLI (published as `neuronai`) |
| `apps/mcp-server` | MCP stdio server |
| `packages/*` | Shared libraries (`@neuronai/*`) |
| `docs/` | User and project documentation |

## Reviews

Maintainers may ask for smaller diffs, tests, or docs updates. Please respond to review comments or mark conversations resolved.

## Security

See [SECURITY.md](./SECURITY.md).

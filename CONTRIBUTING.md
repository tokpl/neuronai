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
pnpm verify            # the full gate: lint, typecheck, test, build, package, offline
pnpm verify:package    # packs the CLI and installs it into a clean project
pnpm verify:offline    # runs the CLI with sockets, DNS and fetch disabled
pnpm neuron -- status  # run the local CLI from the monorepo
```

Published npm package: **`neuronai`** only. The `@neuronai/*` workspace libraries are private
and bundled into the CLI, so a user's install never resolves them from the registry.

## Issues

1. Search existing issues first
2. For vulnerabilities, follow [SECURITY.md](./SECURITY.md) — **do not** file a public bug with exploit details

Good bug reports include: NeuronAI version (`neuron --version`), OS, minimal repro, the output of
`neuron doctor`, and redacted logs.

## Pull requests

**There is no CI on this repository.** `pnpm verify` is the only gate, and it runs on your
machine — please do not skip it.

1. Fork and create a branch from `main`
2. Keep PRs focused (one concern per PR when practical)
3. Add/update tests when behavior changes
4. Run before opening the PR:

```bash
pnpm verify
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

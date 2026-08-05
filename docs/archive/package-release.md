# Package release

## Planned npm names

| Workspace package | Publish name |
|-------------------|--------------|
| `@neuron-ai-memory/cli` | `neuron-ai-memory` (also planned alias `@neuron/cli`) |
| `@neuron-ai-memory/mcp-server` | `@neuron/mcp-server` |
| `@neuron-ai-memory/sdk` | `@neuron/sdk` |

Workspace names stay `@neuron-ai-memory/*` for monorepo imports. `publishConfig.name` remaps on publish.

## Versioning

Semantic Versioning **MAJOR.MINOR.PATCH**. Pre-1.0: breaking changes may appear in minor bumps; document in CHANGELOG.

## Build & publish

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
# with NPM_TOKEN:
# pnpm --filter @neuron-ai-memory/cli publish --access public --no-git-checks
# pnpm --filter @neuron-ai-memory/mcp-server publish --access public --no-git-checks
# pnpm --filter @neuron-ai-memory/sdk publish --access public --no-git-checks
```

Release workflow (`.github/workflows/release.yml`) generates notes on `v*` tags; npm publish step is commented until tokens exist.

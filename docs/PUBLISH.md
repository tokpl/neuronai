# Publishing NeuronAI to npm

Product name: **NeuronAI**  
Slogan / title: **Neuron - AI Memory**  
npm org / scope: **`@neuronai`** (owned by `tokpl`)  
Install name: `neuronai` (+ scoped `@neuronai/*`)

## What goes where

| Surface | Contents |
|---------|----------|
| GitHub | Full monorepo |
| npm `neuronai` | CLI (`apps/cli`) - bins `neuron` / `neuronai` |
| npm `@neuronai/*` | Libraries + `@neuronai/mcp-server` under org **neuronai** |

Root `neuronai-monorepo` is private and is never published.

## Prerequisites

```bash
npm whoami          # tokpl
npm org ls neuronai # tokpl - owner
```

## Release

```bash
pnpm publish:npm
```

Publishes all `@neuronai/*` + `neuronai` with `--access public`.  
`pnpm` rewrites `workspace:*` to real versions in the tarball.

Dry-run one package:

```bash
pnpm --filter neuronai publish --dry-run --no-git-checks
```

## After publish

```bash
npm install -g neuronai
# or
npx neuronai init
```

Packages appear under:
- https://www.npmjs.com/org/neuronai
- https://www.npmjs.com/package/neuronai
- https://www.npmjs.com/settings/tokpl/packages

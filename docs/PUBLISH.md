# Publishing NeuronAI to npm

Product name: **NeuronAI**  
Slogan / title: **Neuron - AI Memory**  
npm install name: `neuronai` (+ scoped `@neuronai/*`)

## What goes where

| Surface | Contents |
|---------|----------|
| GitHub | Full monorepo (this repo) |
| npm `neuronai` | CLI + `bin` (`neuron` / `neuronai`) from `apps/cli` |
| npm `@neuronai/*` | Workspace libraries + `@neuronai/mcp-server` |

Root package `neuronai-monorepo` is **private** and is never published.

## One-time

1. `npm login` (account that owns the `neuronai` / `@neuronai` scope)
2. Ensure `@neuronai` org exists on npm (or publish unscoped only - we use scoped libs)

## Release

```bash
pnpm install
pnpm build
pnpm test
pnpm publish:npm
```

`pnpm` rewrites `workspace:*` to real versions in the published tarball.

Dry-run a single package:

```bash
pnpm --filter neuronai publish --dry-run --no-git-checks
```

## After publish

Users install:

```bash
npm install -g neuronai
# or
npx neuronai init
```

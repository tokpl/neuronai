# 01 — Install

## Goal

Viewer sees Neuron installs cleanly on a fresh machine.

## Prep

- Empty terminal (or clear scrollback)
- Node 22+ and pnpm available (`node -v`, `pnpm -v`)

## Steps (record)

1. Show:
   ```bash
   git clone https://github.com/YOUR_ORG/neuron-ai-memory.git
   cd neuron-ai-memory
   ```
2. Run:
   ```bash
   pnpm install
   pnpm build
   ```
3. Pause on successful turbo build summary.
4. Optional: `pnpm neuron --version` → `0.1.0`

## Narration

> “Clone, install, build — Neuron is a local monorepo. No account required.”

## Do not show

- `.env` with real secrets
- Failed builds without recovery

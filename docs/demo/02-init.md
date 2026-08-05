# 02 — Init

## Goal

First-run experience: checkmarks + welcome message.

## Prep

```bash
cd examples/neuron-demo
# or any empty/sample app folder
```

## Steps (record)

1. Run:
   ```bash
   pnpm --dir ../.. neuron init --force
   # from monorepo: pnpm neuron init (inside demo after linking)
   ```
   Preferred onboarding path for video:
   ```bash
   neuron init cursor
   ```
2. Capture the checkmark sequence:
   - Project detected
   - Stack analyzed
   - Cursor configured
   - Initial brain created
3. Capture welcome block:
   - “Your project now has a memory layer.”
   - Detected stack
   - Memory count
   - Cursor MCP path

## Narration

> “One command wires the project brain and Cursor MCP.”

## Cut if

Init already exists — use `--force` or a fresh temp copy of the demo.

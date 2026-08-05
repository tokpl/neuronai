# Neuron integrations

Host-specific adapters live under `.neuron/integrations/` after `neuron init`.

| Host | Status | Notes |
|------|--------|-------|
| `cursor/` | Active | Templates + `@neuron-ai-memory/cursor-integration` |
| `claude-code/` | Extension point | Stub only — Cursor-first milestone |
| `vscode/` | Extension point | Stub only |

Do not put business logic here — only host wiring manifests and docs.

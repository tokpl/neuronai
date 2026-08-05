# Privacy

Neuron is **local-first**. Data residency, consent, and AI routing share one policy surface.

## Data residency & consent

- Project brain lives under `.neuron/` on the developer machine
- Telemetry defaults to **OFF** (see `packages/security` privacy consent)
- Memory write modes: `manual` | `suggest` | `automatic` (agent-workflow)
- No mandatory cloud account

## AI Runtime privacy

Config: `.neuron/ai.json` → `allowCloud`, `mode`, `redactLogs`

### PrivacyRouter

Before outbound model calls:

1. Secret detection
2. Local-only / cloud-blocked policy
3. **ContextClassifier** labels: PUBLIC · INTERNAL · SENSITIVE · CRITICAL

| Category | Examples | Cloud |
|----------|----------|-------|
| PUBLIC | README, LICENSE | Allowed if `allowCloud` |
| INTERNAL | `src/`, packages | Allowed with consent |
| SENSITIVE | auth/, keyed snippets | Local only |
| CRITICAL | `.env`, private keys | Local only — never leave the machine |

### Rules

- Never send code to cloud without consent
- Never store API keys in the project brain (`apiKeyEnv` only)
- Never log prompts that still contain secrets (`redactSecrets`)
- Embeddings keep **content hashes**, not source text by default

### Hybrid / offline

```text
Local:  parsing, summarization, retrieval, security review
Cloud:  architecture reasoning — only if allowCloud + consent
Offline mode: scan, graph, memory retrieval, basic analysis — no cloud
```

MCP: `neuron_privacy_check`

See [ai-runtime.md](./ai-runtime.md) and [local-models.md](./local-models.md).

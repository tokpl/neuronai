# Configuration

## Files

| Path | Purpose |
|------|---------|
| `.neuron/config.json` | Project id, privacy mode, integrations |
| `neuron.config.json` | Shared package config (MCP/runtime) |
| `.env` | Secrets & env overrides (never commit) |

## Environment

See [`.env.example`](../.env.example).

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Optional Postgres (+ pgvector) |
| `LOG_LEVEL` | `fatal`…`trace` |
| `NEURON_MODE` | `local` \| `cloud` |
| `NEURON_API_KEY` | Required when `NEURON_MODE=cloud` |
| `NEURON_PRIVACY_MODE` | `manual` \| `suggest` \| `automatic` |
| `NEURON_CWD` | Project root for MCP |
| `OPENAI_API_KEY` | Optional embeddings / LLM provider |
| `NEURON_TELEMETRY` | Must be `1` **and** consent to enable metrics (future) |

## Privacy modes

Configured in `.neuron/config.json`:

```json
{
  "privacy": { "mode": "suggest" }
}
```

## Secrets

- Never commit `.env`
- Never log `DATABASE_URL` / API keys (use redaction)
- Prefer OS secret stores for production self-host

# Local models

Neuron discovers and prefers local runtimes when `allowCloud` is false (default).

## Supported local providers

| Provider | Default endpoint | Notes |
|----------|------------------|-------|
| **Ollama** | `http://127.0.0.1:11434` | `/api/tags` discovery + OpenAI-compatible `/v1` |
| **LM Studio** | `http://127.0.0.1:1234/v1` | OpenAI-compatible |
| **Offline** | (none) | Heuristics + hash embeddings — always available |

## LocalModelManager

Probes:

- Installed models (Ollama tags / LM Studio `/models`)
- Available system memory
- GPU capability (heuristic — Node cannot reliably detect GPUs)

```bash
# Via MCP
neuron_ai_status
neuron_model_health
```

## Workflow

1. Install Ollama or LM Studio and pull a model
2. Set `.neuron/ai.json` → `"preferredProvider": "ollama"`, `"allowCloud": false`
3. Call `neuron_select_model` with task `SUMMARIZATION` or `CODE_ANALYSIS`
4. Neuron routes to the local provider; falls back to offline heuristics if unreachable

## Enterprise private models

Use `custom-http` provider pointing at an internal OpenAI-compatible gateway.
Store API keys only in environment variables (`apiKeyEnv`) — never in the brain.

Neuron does **not** download, fine-tune, or train models.

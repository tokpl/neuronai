# AI Runtime

Neuron sits **above** existing models — it does not train or host a cloud LLM platform.

Package: `@neuron-ai-memory/ai-runtime` → `packages/ai-runtime`.

## Architecture

```text
packages/ai-runtime/src/
  providers/     OpenAI-compatible, Anthropic, Ollama, LM Studio, Custom HTTP, Offline
  models/        TaskProfile + LocalModelManager
  routing/       ModelRouter + HybridAI
  embeddings/    RuntimeEmbeddingProvider (hashes, not source text by default)
  context/       ContextClassifier (PUBLIC → CRITICAL)
  privacy/       PrivacyRouter + OfflineMode
  evaluation/    ModelPerformanceMemory
  facade/        AiRuntime
```

Config: `.neuron/ai.json`

```json
{
  "mode": "hybrid",
  "allowCloud": false,
  "preferredProvider": "ollama",
  "redactLogs": true,
  "providers": []
}
```

Performance memory (no prompts): `.neuron/ai-performance.json`

## RuntimeAIProvider contract

Every provider implements:

- `generate()` / `embed()` / `analyze()` / `summarize()` / `reason()`
- `health()`

## Task profiles

| Profile | Typical model |
|---------|----------------|
| SUMMARIZATION | small local |
| MEMORY_RETRIEVAL | embedding |
| CODE_ANALYSIS | medium local |
| SECURITY_REVIEW | medium local |
| ARCHITECTURE_REASONING | large (cloud only with consent) |
| DOCUMENTATION | medium local |

## MCP tools

- `neuron_ai_status`
- `neuron_select_model` / `neuron_best_model_for_task`
- `neuron_privacy_check`
- `neuron_model_health`
- `neuron_available_models`

See [local-models.md](./local-models.md) and [privacy.md](./privacy.md).

# @neuron-ai-memory/ai-provider

LLM / multimodal AI abstraction for Neuron.

## Interface

```ts
interface AIProvider {
  analyze(text, context?): Promise<string>
  extract(text): Promise<string>
  classify(text): Promise<string>
  summarize(text): Promise<string>
  generateEmbedding(texts): Promise<number[][]>
}
```

`MockAIProvider` is deterministic and offline-friendly (heuristics + hash embeddings).

OpenAI / Anthropic / Gemini production adapters can implement the same interface without changing the intelligence pipeline.

# @neuronai/embeddings

Embedding providers and in-memory vector store for Neuron semantic search.

- `MockEmbeddingProvider` / `HashEmbeddingProvider` - local deterministic vectors
- `OpenAICompatibleEmbeddingProvider` - remote OpenAI-compatible API
- `InMemoryEmbeddingStore` - process-local vector index (Postgres/pgvector in later milestone)

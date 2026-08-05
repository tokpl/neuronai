import type { EmbedResult, RuntimeAIProvider } from '../types.js';
import { contentHash } from '../providers/base.js';

/**
 * Embedding facade — local or cloud providers.
 * Stores content hashes with vectors; does not persist source text by default.
 */
export class RuntimeEmbeddingProvider {
  constructor(private readonly provider: RuntimeAIProvider) {}

  async embed(texts: string[]): Promise<EmbedResult> {
    const result = await this.provider.embed(texts);
    return {
      ...result,
      contentHashes: result.contentHashes.length
        ? result.contentHashes
        : texts.map(contentHash),
    };
  }
}

export function createRuntimeEmbeddingProvider(
  provider: RuntimeAIProvider,
): RuntimeEmbeddingProvider {
  return new RuntimeEmbeddingProvider(provider);
}

import { describe, expect, it } from 'vitest';

import {
  MockEmbeddingProvider,
  cosineSimilarity,
  createEmbedder,
  contentHash,
} from '../src/index.js';

describe('embeddings', () => {
  it('creates deterministic vectors', async () => {
    const provider = new MockEmbeddingProvider();
    const [a] = await provider.embed(['RBAC permission system']);
    const [b] = await provider.embed(['RBAC permission system']);
    const [c] = await provider.embed(['totally unrelated cooking recipe']);
    expect(cosineSimilarity(a!, b!)).toBeGreaterThan(0.99);
    expect(cosineSimilarity(a!, c!)).toBeLessThan(cosineSimilarity(a!, b!));
  });

  it('createEmbedder returns a provider', async () => {
    const embedder = createEmbedder('mock');
    expect(embedder.model).toContain('mock');
    expect(contentHash('abc')).toMatch(/^[0-9a-f]+$/);
  });
});

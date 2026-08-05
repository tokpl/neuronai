import type { MemoryRecord } from '@neuron-ai-memory/types';

import {
  createDuplicateMemoryDetector,
  type DuplicateMemoryDetector,
} from '../cleanup/duplicate-detector.js';
import type { DuplicateSuggestion } from '../types.js';

/**
 * MemorySimilarityEngine — detects near-duplicate memories and merge suggestions.
 * Example: "Use Redis cache" ≈ "Redis is used for caching".
 */
export class MemorySimilarityEngine {
  private readonly duplicates: DuplicateMemoryDetector = createDuplicateMemoryDetector();

  detect(memories: MemoryRecord[]): DuplicateSuggestion[] {
    return this.duplicates.detect(memories);
  }

  suggestMerge(left: MemoryRecord, right: MemoryRecord): DuplicateSuggestion | null {
    const hits = this.duplicates.detect([left, right]);
    return hits[0] ?? null;
  }
}

export function createMemorySimilarityEngine(): MemorySimilarityEngine {
  return new MemorySimilarityEngine();
}

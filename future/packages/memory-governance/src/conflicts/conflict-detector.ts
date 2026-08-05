import type { MemoryRecord } from '@neuron-ai-memory/types';

import { createConflictResolver } from '../conflicts/resolver.js';
import type { ConflictResolutionSuggestion } from '../types.js';

/**
 * MemoryConflictDetector — e.g. REST vs GraphQL.
 * Requires human resolution; never auto-picks a winner silently.
 */
export class MemoryConflictDetector {
  private readonly resolver = createConflictResolver();

  detect(memories: MemoryRecord[]): ConflictResolutionSuggestion[] {
    return this.resolver.resolve(memories);
  }
}

export function createMemoryConflictDetector(): MemoryConflictDetector {
  return new MemoryConflictDetector();
}

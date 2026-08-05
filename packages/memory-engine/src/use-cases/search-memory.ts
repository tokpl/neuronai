import { NotImplementedError, type MemoryRecord } from '@neuronai/types';

/**
 * Optional semantic/hybrid search port.
 * Implemented by `@neuronai/ai-memory` HybridMemorySearchEngine.
 */
export interface MemorySearcher {
  search(input: {
    projectId: string;
    query: string;
    limit?: number;
  }): Promise<{ results: Array<{ memory: MemoryRecord; score: number }> }>;
}

export interface SearchMemoryInput {
  projectId: string;
  query: string;
  limit?: number;
}

export interface SearchMemoryResult {
  results: Array<{ memory: MemoryRecord; score: number }>;
}

export class SearchMemory {
  constructor(private readonly searcher?: MemorySearcher) {}

  async execute(input: SearchMemoryInput): Promise<SearchMemoryResult> {
    if (!this.searcher) {
      throw new NotImplementedError(
        'SearchMemory (wire HybridMemorySearchEngine from @neuronai/ai-memory)',
      );
    }
    return this.searcher.search(input);
  }
}

import type { MemoryRecord } from '@neuronai/types';

/** Ranking port. The runtime wires this to the lexical engine in `@neuronai/brain`. */
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
    // No searcher wired means nothing is indexed, which is an empty result — not an error.
    if (!this.searcher) return { results: [] };
    return this.searcher.search(input);
  }
}

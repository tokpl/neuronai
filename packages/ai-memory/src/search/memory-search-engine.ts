import type { MemoryRecord, MemoryType } from '@neuron-ai-memory/types';
import type { MemoryRepository } from '@neuron-ai-memory/memory-engine';
import {
  cosineSimilarity,
  contentHash,
  type EmbeddingProvider,
  type EmbeddingStore,
} from '@neuron-ai-memory/embeddings';

export interface MemorySearchQuery {
  projectId: string;
  query: string;
  limit?: number;
  types?: MemoryType[];
  minImportance?: number;
}

export interface RankedMemoryHit {
  memory: MemoryRecord;
  score: number;
  components: {
    vector: number;
    keyword: number;
    importance: number;
    freshness: number;
  };
}

export interface MemorySearchEngine {
  indexMemory(memory: MemoryRecord): Promise<void>;
  search(query: MemorySearchQuery): Promise<RankedMemoryHit[]>;
}

/**
 * Hybrid search:
 * score = 0.45*vector + 0.25*keyword + 0.20*importance + 0.10*freshness
 */
export class HybridMemorySearchEngine implements MemorySearchEngine {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly embeddings: EmbeddingProvider,
    private readonly store: EmbeddingStore,
  ) {}

  async indexMemory(memory: MemoryRecord): Promise<void> {
    const [vector] = await this.embeddings.embed([`${memory.title}\n${memory.content}`]);
    await this.store.upsert({
      memoryId: memory.id,
      projectId: memory.projectId,
      vector: vector ?? [],
      model: this.embeddings.model,
      contentHash: contentHash(memory.content),
    });
  }

  async search(query: MemorySearchQuery): Promise<RankedMemoryHit[]> {
    const limit = query.limit ?? 10;
    const candidates = await this.memories.findByProject({
      projectId: query.projectId,
      status: 'active',
      limit: 200,
    });

    const filtered = candidates
      .map((m) => m.toRecord())
      .filter((m) => {
        if (query.types && !query.types.includes(m.type)) return false;
        if (query.minImportance !== undefined && m.importanceScore < query.minImportance) {
          return false;
        }
        return true;
      });

    const [queryVector] = await this.embeddings.embed([query.query]);
    const qv = queryVector ?? [];
    const queryTokens = tokenize(query.query);

    const ranked: RankedMemoryHit[] = [];
    for (const memory of filtered) {
      const embedded = await this.store.getByMemoryId(memory.id);
      const vectorScore = embedded ? cosineSimilarity(qv, embedded.vector) : 0;
      const keywordScore = keywordOverlap(
        queryTokens,
        tokenize(`${memory.title} ${memory.content}`),
      );
      const importance = memory.importanceScore;
      const freshness = memory.freshnessScore;
      const score = 0.45 * vectorScore + 0.25 * keywordScore + 0.2 * importance + 0.1 * freshness;

      ranked.push({
        memory,
        score: Number(score.toFixed(4)),
        components: {
          vector: Number(vectorScore.toFixed(4)),
          keyword: Number(keywordScore.toFixed(4)),
          importance,
          freshness,
        },
      });
    }

    return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function keywordOverlap(query: Set<string>, doc: Set<string>): number {
  if (query.size === 0) return 0;
  let hit = 0;
  for (const t of query) if (doc.has(t)) hit += 1;
  return hit / query.size;
}

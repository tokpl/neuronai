import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { AnalyzedTask } from './task-analyzer.js';

export interface RankedContextItem {
  id: string;
  kind: 'memory' | 'graph' | 'warning';
  title: string;
  content: string;
  score: number;
  components: {
    taskRelevance: number;
    graphDistance: number;
    importance: number;
    freshness: number;
    confidence: number;
  };
}

export interface RankableMemory {
  memory: MemoryRecord;
  /** 0 = self, higher = farther in graph (optional) */
  graphDistance?: number;
}

/**
 * Ranks candidate context so agents get signal, not the whole memory dump.
 */
export class ContextRanker {
  rank(task: AnalyzedTask, items: RankableMemory[], limit: number): RankedContextItem[] {
    const keywords = new Set(task.keywords);
    const areas = new Set(task.affectedAreas.map((a) => a.toLowerCase()));

    const ranked: RankedContextItem[] = items.map(({ memory, graphDistance = 2 }) => {
      const hay = `${memory.title}\n${memory.content}\n${memory.tags.join(' ')}`.toLowerCase();
      let taskRelevance = 0;
      for (const kw of keywords) {
        if (hay.includes(kw)) taskRelevance += 0.08;
      }
      for (const area of areas) {
        if (hay.includes(area)) taskRelevance += 0.12;
      }
      taskRelevance = Math.min(1, taskRelevance);

      const graphDistanceScore = Math.max(0, 1 - graphDistance * 0.25);
      const importance = memory.importanceScore;
      const freshness = memory.freshnessScore;
      const confidence = memory.confidenceScore;

      const score =
        0.35 * taskRelevance +
        0.2 * graphDistanceScore +
        0.25 * importance +
        0.1 * freshness +
        0.1 * confidence;

      return {
        id: memory.id,
        kind: 'memory' as const,
        title: memory.title,
        content: memory.content,
        score: Math.round(score * 1000) / 1000,
        components: {
          taskRelevance,
          graphDistance: graphDistanceScore,
          importance,
          freshness,
          confidence,
        },
      };
    });

    return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export function createContextRanker(): ContextRanker {
  return new ContextRanker();
}

import type { MemoryRecord } from '@neuronai/types';

import type { MemoryRepository } from '../domain/repositories/index.js';

export interface GetProjectMemoryContextInput {
  projectId: string;
  limit?: number;
  maxTokens?: number;
}

export interface GetProjectMemoryContextResult {
  memories: MemoryRecord[];
  warnings: string[];
  tokenEstimate: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class GetProjectMemoryContext {
  constructor(private readonly memories: MemoryRepository) {}

  async execute(input: GetProjectMemoryContextInput): Promise<GetProjectMemoryContextResult> {
    const limit = input.limit ?? 20;
    const maxTokens = input.maxTokens ?? 3000;

    const active = await this.memories.findByProject({
      projectId: input.projectId,
      status: 'active',
      limit: 100,
    });

    const ranked = [...active].sort((a, b) => {
      const scoreA = a.importance.value * 0.7 + a.freshnessScore * 0.3;
      const scoreB = b.importance.value * 0.7 + b.freshnessScore * 0.3;
      return scoreB - scoreA;
    });

    const selected: MemoryRecord[] = [];
    let tokens = 0;
    const warnings: string[] = [];

    for (const memory of ranked) {
      if (selected.length >= limit) break;
      const record = memory.toRecord();
      const cost = estimateTokens(`${record.title}\n${record.content}`);
      if (tokens + cost > maxTokens) {
        warnings.push('Token budget reached; some memories omitted');
        break;
      }
      selected.push(record);
      tokens += cost;
      memory.markUsed();
      await this.memories.update(memory);
    }

    return {
      memories: selected,
      warnings,
      tokenEstimate: tokens,
    };
  }
}

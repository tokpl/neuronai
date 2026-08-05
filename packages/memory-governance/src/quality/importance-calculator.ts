import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { ImportanceBreakdown } from '../types.js';
import { clamp01, daysSince } from '../types.js';

/**
 * MemoryImportanceCalculator — frequency, connections, business impact, usage, validation.
 */
export class MemoryImportanceCalculator {
  calculate(
    memory: MemoryRecord,
    ctx: { relatedCount?: number; validated?: boolean; now?: Date } = {},
  ): ImportanceBreakdown {
    const now = ctx.now ?? new Date();
    const unusedDays = daysSince(memory.lastUsedAt ?? memory.updatedAt, now);

    const frequency = clamp01(memory.usageCount / 50);
    const connections = clamp01((ctx.relatedCount ?? 0) / 8);
    const businessImpact = clamp01(
      memory.type === 'architecture_decision' || memory.type === 'business_rule'
        ? 0.9
        : memory.type === 'mistake' || /security|payment|auth/i.test(`${memory.title} ${memory.tags.join(' ')}`)
          ? 0.85
          : memory.importanceScore,
    );
    const recentUsage = clamp01(1 - unusedDays / 120);
    const developerValidation = clamp01(
      (ctx.validated ? 0.9 : 0) + memory.confidenceScore * 0.4 + (memory.source === 'manual' ? 0.2 : 0),
    );

    const importance = clamp01(
      0.25 * frequency +
        0.15 * connections +
        0.25 * businessImpact +
        0.2 * recentUsage +
        0.15 * developerValidation,
    );

    return {
      memoryId: memory.id,
      frequency,
      connections,
      businessImpact,
      recentUsage,
      developerValidation,
      importance,
    };
  }
}

export function createMemoryImportanceCalculator(): MemoryImportanceCalculator {
  return new MemoryImportanceCalculator();
}

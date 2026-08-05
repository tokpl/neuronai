import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { DecayAdjustment, ReviewPriority } from '../types.js';
import { clamp01, daysSince } from '../types.js';

/**
 * MemoryDecayEngine — lowers confidence/importance/priority over time.
 * Never deletes information.
 */
export class MemoryDecayEngine {
  adjust(
    memory: MemoryRecord,
    ctx: {
      now?: Date;
      stale?: boolean;
      conflicted?: boolean;
      projectChanged?: boolean;
    } = {},
  ): DecayAdjustment {
    const now = ctx.now ?? new Date();
    const ageDays = daysSince(memory.updatedAt ?? memory.createdAt, now);
    const unusedDays = daysSince(memory.lastUsedAt ?? memory.updatedAt, now);

    const ageFactor = clamp01(ageDays / 365);
    const unusedFactor = clamp01(unusedDays / 180);
    const usageBoost = clamp01(memory.usageCount / 20);

    let nextConfidence = clamp01(
      memory.confidenceScore * (1 - 0.25 * ageFactor - 0.2 * unusedFactor) + 0.1 * usageBoost,
    );
    let nextImportance = clamp01(
      memory.importanceScore * (1 - 0.2 * ageFactor - 0.15 * unusedFactor) + 0.15 * usageBoost,
    );

    const reasons: string[] = [];
    if (ageFactor > 0.3) reasons.push(`age ${Math.round(ageDays)}d`);
    if (unusedFactor > 0.3) reasons.push(`unused ${Math.round(unusedDays)}d`);
    if (usageBoost > 0.3) reasons.push('recent usage dampens decay');
    if (ctx.stale) {
      nextConfidence = clamp01(nextConfidence * 0.75);
      nextImportance = clamp01(nextImportance * 0.85);
      reasons.push('project change / stale tech signal');
    }
    if (ctx.conflicted) {
      nextConfidence = clamp01(nextConfidence * 0.7);
      reasons.push('conflicted with another memory');
    }
    if (ctx.projectChanged) {
      nextConfidence = clamp01(nextConfidence * 0.8);
      reasons.push('codebase changed since last validation');
    }
    if (memory.type === 'architecture_decision') {
      // Protect important decisions from aggressive decay
      nextConfidence = Math.max(nextConfidence, memory.confidenceScore * 0.85);
      nextImportance = Math.max(nextImportance, memory.importanceScore * 0.9);
      reasons.push('architecture decisions decay slowly');
    }

    const priority: ReviewPriority =
      nextConfidence < 0.35 || ctx.conflicted
        ? 'high'
        : nextConfidence < 0.55 || ctx.stale
          ? 'medium'
          : 'low';

    return {
      memoryId: memory.id,
      previousConfidence: memory.confidenceScore,
      nextConfidence,
      previousImportance: memory.importanceScore,
      nextImportance,
      priority,
      reasons,
      destructive: false,
    };
  }

  adjustMany(
    memories: MemoryRecord[],
    ctx: {
      now?: Date;
      staleIds?: Set<string>;
      conflictIds?: Set<string>;
      projectChangedIds?: Set<string>;
    } = {},
  ): DecayAdjustment[] {
    return memories.map((m) =>
      this.adjust(m, {
        now: ctx.now,
        stale: ctx.staleIds?.has(m.id),
        conflicted: ctx.conflictIds?.has(m.id),
        projectChanged: ctx.projectChangedIds?.has(m.id),
      }),
    );
  }
}

export function createMemoryDecayEngine(): MemoryDecayEngine {
  return new MemoryDecayEngine();
}

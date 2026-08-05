import type { MemoryRecord } from '@neuron-ai-memory/types';

import { createMemoryImportanceCalculator } from './importance-calculator.js';
import type { MemoryHealthScore, MemoryLifecycleState } from '../types.js';
import { clamp01, clamp100, daysSince } from '../types.js';

/**
 * Per-memory health: accuracy · usage · freshness · confidence · relationships → 0–100.
 */
export class MemoryHealthScorer {
  private readonly importance = createMemoryImportanceCalculator();

  score(
    memory: MemoryRecord,
    ctx: {
      now?: Date;
      relatedCount?: number;
      staleBoost?: number;
      conflictPenalty?: number;
      validated?: boolean;
    } = {},
  ): MemoryHealthScore {
    const now = ctx.now ?? new Date();
    const ageDays = daysSince(memory.updatedAt ?? memory.createdAt, now);
    const unusedDays = daysSince(memory.lastUsedAt ?? memory.updatedAt, now);

    const freshnessScore = clamp01(memory.freshnessScore * 0.4 + Math.max(0, 1 - ageDays / 365) * 0.6);
    const usageScore = clamp01(
      Math.min(1, memory.usageCount / 10) * 0.55 + Math.max(0, 1 - unusedDays / 180) * 0.45,
    );
    const confidenceScore = clamp01(memory.confidenceScore);
    const accuracyScore = clamp01(
      confidenceScore * 0.5 +
        freshnessScore * 0.3 +
        (memory.status === 'active' ? 0.2 : memory.status === 'superseded' ? 0.05 : 0.1) -
        (ctx.staleBoost ?? 0) -
        (ctx.conflictPenalty ?? 0),
    );
    const relationshipScore = clamp01((ctx.relatedCount ?? 0) / 5);
    const importance = this.importance.calculate(memory, {
      relatedCount: ctx.relatedCount,
      validated: ctx.validated,
      now,
    }).importance;

    const healthScore = clamp100(
      100 *
        (0.28 * accuracyScore +
          0.18 * usageScore +
          0.22 * freshnessScore +
          0.18 * confidenceScore +
          0.14 * relationshipScore),
    );

    const lifecycle = inferLifecycle(memory, healthScore, ageDays, unusedDays, ctx);

    return {
      memoryId: memory.id,
      accuracyScore,
      usageScore,
      freshnessScore,
      confidenceScore,
      relationshipScore,
      healthScore,
      lifecycle,
      importance,
      whyImportant: explainImportance(memory, usageScore, confidenceScore, importance),
      whyReviewOrRemove:
        healthScore < 55 || lifecycle === 'OUTDATED' || lifecycle === 'CONFLICTED'
          ? explainRemoval(memory, healthScore, ageDays, unusedDays, ctx)
          : undefined,
    };
  }
}

function inferLifecycle(
  memory: MemoryRecord,
  health: number,
  ageDays: number,
  unusedDays: number,
  ctx: { staleBoost?: number; conflictPenalty?: number; validated?: boolean },
): MemoryLifecycleState {
  if (memory.status === 'archived' || memory.status === 'superseded') return 'ARCHIVED';
  if ((ctx.conflictPenalty ?? 0) > 0.2) return 'CONFLICTED';
  if ((ctx.staleBoost ?? 0) > 0.25 || health < 45 || unusedDays > 120) return 'OUTDATED';
  if (ageDays > 90 || unusedDays > 60 || health < 65) return 'OUTDATED';
  if (memory.usageCount === 0 && ageDays < 7) return 'PROPOSED';
  if (ctx.validated || (memory.confidenceScore >= 0.7 && memory.usageCount > 0)) return 'VALIDATED';
  return 'ACTIVE';
}

function explainImportance(
  m: MemoryRecord,
  usage: number,
  confidence: number,
  importance: number,
): string {
  const bits = [
    `Type=${m.type}`,
    `importance=${Math.round(importance * 100)}%`,
    usage > 0.4 ? 'frequently referenced' : 'low recent usage',
    confidence > 0.7 ? 'high confidence' : 'moderate confidence',
  ];
  return `Why important: ${bits.join('; ')}.`;
}

function explainRemoval(
  m: MemoryRecord,
  health: number,
  ageDays: number,
  unusedDays: number,
  ctx: { staleBoost?: number; conflictPenalty?: number },
): string {
  const reasons: string[] = [];
  if (health < 55) reasons.push(`health ${health}/100`);
  if (ageDays > 90) reasons.push(`last update ${Math.round(ageDays)}d ago`);
  if (unusedDays > 60) reasons.push(`unused ~${Math.round(unusedDays)}d`);
  if ((ctx.staleBoost ?? 0) > 0) reasons.push('stale technology / project change signal');
  if ((ctx.conflictPenalty ?? 0) > 0) reasons.push('conflicts with a newer decision');
  return `Why review: ${reasons.join('; ') || 'quality below threshold'}. Approval required — Neuron never deletes.`;
}

export function createMemoryHealthScorer(): MemoryHealthScorer {
  return new MemoryHealthScorer();
}

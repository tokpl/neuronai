import type { MemoryRecord } from '@neuron-ai-memory/types';

export interface RetrievalEvalCase {
  id: string;
  query: string;
  /** Memory IDs that should appear in top-k */
  relevantMemoryIds: string[];
}

export interface MemoryEvaluationInput {
  memories: MemoryRecord[];
  retrievalCases?: RetrievalEvalCase[];
  retrievedTopK?: Map<string, string[]>;
  conflictCount?: number;
}

export interface MemoryEvaluationReport {
  retrievalAccuracy: number | null;
  duplicateRate: number;
  conflictRate: number;
  usefulnessScore: number;
  notes: string[];
}

/**
 * Lightweight offline evaluation helpers (no LLM judge yet).
 */
export class MemoryEvaluation {
  evaluate(input: MemoryEvaluationInput): MemoryEvaluationReport {
    const notes: string[] = [];
    const active = input.memories.filter((m) => m.status === 'active');

    const duplicateRate = estimateDuplicateRate(active);
    const conflictRate =
      active.length === 0 ? 0 : clamp01((input.conflictCount ?? 0) / Math.max(active.length, 1));

    let retrievalAccuracy: number | null = null;
    if (input.retrievalCases?.length && input.retrievedTopK) {
      let hits = 0;
      for (const c of input.retrievalCases) {
        const top = input.retrievedTopK.get(c.id) ?? [];
        if (c.relevantMemoryIds.some((id) => top.includes(id))) hits += 1;
      }
      retrievalAccuracy = hits / input.retrievalCases.length;
    } else {
      notes.push('retrievalAccuracy skipped — no eval cases provided');
    }

    const usefulnessScore = estimateUsefulness(active);

    return {
      retrievalAccuracy,
      duplicateRate: Number(duplicateRate.toFixed(4)),
      conflictRate: Number(conflictRate.toFixed(4)),
      usefulnessScore: Number(usefulnessScore.toFixed(4)),
      notes,
    };
  }
}

function estimateDuplicateRate(memories: MemoryRecord[]): number {
  if (memories.length < 2) return 0;
  let dupes = 0;
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      if (
        memories[i]!.title.toLowerCase() === memories[j]!.title.toLowerCase() &&
        memories[i]!.projectId === memories[j]!.projectId
      ) {
        dupes += 1;
      }
    }
  }
  const pairs = (memories.length * (memories.length - 1)) / 2;
  return dupes / pairs;
}

function estimateUsefulness(memories: MemoryRecord[]): number {
  if (memories.length === 0) return 0;
  const avgImportance = memories.reduce((s, m) => s + m.importanceScore, 0) / memories.length;
  const usageBoost =
    memories.reduce((s, m) => s + Math.min(1, m.usageCount / 5), 0) / memories.length;
  return clamp01(avgImportance * 0.7 + usageBoost * 0.3);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

import type { AssembledContext, RankedHit } from '../types.js';

export interface RetrievalMetrics {
  precision: number;
  recall: number;
  contextUsefulness: number;
  tokenEfficiency: number;
  noiseRatio: number;
  summary: string;
}

/**
 * Offline-ish evaluator for retrieval quality (heuristic; not a trained model).
 */
export class RetrievalEvaluator {
  evaluate(input: {
    selected: RankedHit[];
    relevantIds?: string[];
    allCandidateCount: number;
    tokenEstimate: number;
    tokenBudget: number;
    context: AssembledContext;
  }): RetrievalMetrics {
    const relevant = new Set(input.relevantIds ?? []);
    const selectedIds = input.selected.map((s) => s.id);
    const tp = relevant.size
      ? selectedIds.filter((id) => relevant.has(id)).length
      : Math.round(input.selected.filter((s) => s.finalScore >= 0.45).length);
    const precision = selectedIds.length ? tp / selectedIds.length : 0;
    const recall = relevant.size
      ? tp / relevant.size
      : clamp(input.selected.length / Math.max(1, Math.min(20, input.allCandidateCount)));
    const noiseRatio = 1 - precision;
    const tokenEfficiency =
      input.tokenBudget > 0
        ? clamp(1 - Math.abs(input.tokenEstimate - input.tokenBudget * 0.6) / input.tokenBudget)
        : 0.5;
    const contextUsefulness = clamp(
      0.35 * precision +
        0.25 * recall +
        0.2 * tokenEfficiency +
        0.2 * (input.context.warnings.length || input.context.importantDecisions.length ? 0.8 : 0.4),
    );

    return {
      precision: round(precision),
      recall: round(recall),
      contextUsefulness: round(contextUsefulness),
      tokenEfficiency: round(tokenEfficiency),
      noiseRatio: round(noiseRatio),
      summary: `precision=${round(precision)} recall=${round(recall)} usefulness=${round(contextUsefulness)} tokens=${input.tokenEstimate}/${input.tokenBudget}`,
    };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function createRetrievalEvaluator(): RetrievalEvaluator {
  return new RetrievalEvaluator();
}

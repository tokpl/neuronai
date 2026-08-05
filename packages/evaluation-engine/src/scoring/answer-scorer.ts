import type { EvaluationResult } from '../types.js';
import { newId, nowIso, round2 } from '../types.js';
import {
  createQualityMetricsCalculator,
  sanitizeEvalText,
} from '../metrics/quality-metrics.js';

/**
 * Scores an answer against expected signals (no LLM training).
 */
export class AnswerScorer {
  private readonly metrics = createQualityMetricsCalculator();

  evaluate(input: {
    task: string;
    answer: string;
    expectedKeywords?: string[];
    unexpectedKeywords?: string[];
    evidenceSnippets?: string[];
    projectFacts?: string[];
    claimedConfidence?: number;
  }): EvaluationResult {
    const { metrics, criteria, evidence } = this.metrics.compute({
      answer: input.answer,
      expectedKeywords: input.expectedKeywords,
      unexpectedKeywords: input.unexpectedKeywords,
      evidenceSnippets: input.evidenceSnippets,
      projectFacts: input.projectFacts,
      claimedConfidence: input.claimedConfidence,
    });

    return {
      id: newId('eval'),
      task: sanitizeEvalText(input.task, 200),
      input: sanitizeEvalText(input.task, 200),
      output: sanitizeEvalText(input.answer, 400),
      score: metrics.overall,
      criteria,
      evidence,
      metrics,
      timestamp: nowIso(),
    };
  }
}

export function createAnswerScorer(): AnswerScorer {
  return new AnswerScorer();
}

export { round2 };

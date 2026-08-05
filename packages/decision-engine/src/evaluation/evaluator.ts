import type { DecisionFeedback, NeuronDecision } from '../types.js';

export interface DecisionEvaluation {
  accuracy: number;
  usefulness: number;
  developerApproval: number;
  longTermCorrectness: number;
  overall: number;
  notes: string[];
}

/**
 * Evaluate decision quality from feedback + structural signals (not people scoring).
 */
export class DecisionEvaluator {
  evaluate(input: {
    decision: NeuronDecision;
    feedback: DecisionFeedback[];
  }): DecisionEvaluation {
    const related = input.feedback.filter((f) => f.decisionId === input.decision.id);
    const helpful = related.filter((f) => f.label === 'HELPFUL').length;
    const wrong = related.filter((f) => f.label === 'WRONG').length;
    const partial = related.filter((f) => f.label === 'PARTIALLY_CORRECT').length;

    const developerApproval =
      related.length === 0
        ? 0.5
        : clamp((helpful + partial * 0.5) / related.length);

    const accuracy = clamp(
      input.decision.confidence * 0.7 + developerApproval * 0.3 - wrong * 0.1,
    );
    const usefulness = clamp(
      (input.decision.evidence.length >= 3 ? 0.75 : 0.45) * 0.6 +
        (input.decision.reasoning.length >= 2 ? 0.8 : 0.4) * 0.4,
    );
    const longTermCorrectness = clamp(
      developerApproval * 0.5 + (wrong ? 0.3 : 0.7) * 0.5,
    );

    const overall = Math.round(
      (accuracy * 0.3 + usefulness * 0.25 + developerApproval * 0.25 + longTermCorrectness * 0.2) *
        100,
    );

    const notes: string[] = [];
    if (!related.length) notes.push('No developer feedback yet');
    if (input.decision.evidence.length < 2) notes.push('Thin evidence');
    if (wrong) notes.push(`${wrong} WRONG feedback label(s)`);

    return {
      accuracy: Math.round(accuracy * 100),
      usefulness: Math.round(usefulness * 100),
      developerApproval: Math.round(developerApproval * 100),
      longTermCorrectness: Math.round(longTermCorrectness * 100),
      overall,
      notes,
    };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function createDecisionEvaluator(): DecisionEvaluator {
  return new DecisionEvaluator();
}

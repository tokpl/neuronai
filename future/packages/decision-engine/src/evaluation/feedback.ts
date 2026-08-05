import type { DecisionFeedback, FeedbackLabel } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Developer feedback on decisions — improves ranking, never silent auto-apply.
 */
export class FeedbackStore {
  private items: DecisionFeedback[] = [];

  load(items: DecisionFeedback[]): void {
    this.items = [...items];
  }

  list(): DecisionFeedback[] {
    return [...this.items];
  }

  forDecision(decisionId: string): DecisionFeedback[] {
    return this.items.filter((f) => f.decisionId === decisionId);
  }

  record(input: {
    decisionId: string;
    label: FeedbackLabel;
    note?: string;
  }): DecisionFeedback {
    const fb: DecisionFeedback = {
      id: newId('fb'),
      decisionId: input.decisionId,
      label: input.label,
      note: input.note,
      createdAt: nowIso(),
    };
    this.items.unshift(fb);
    return fb;
  }

  /** Aggregate helpfulness for confidence historicalCorrectness */
  historicalCorrectness(): number {
    if (!this.items.length) return 0.6;
    let score = 0.6;
    for (const f of this.items.slice(0, 50)) {
      if (f.label === 'HELPFUL') score += 0.02;
      if (f.label === 'WRONG') score -= 0.03;
      if (f.label === 'PARTIALLY_CORRECT') score += 0.005;
    }
    return Math.max(0.2, Math.min(0.95, score));
  }
}

export function createFeedbackStore(): FeedbackStore {
  return new FeedbackStore();
}

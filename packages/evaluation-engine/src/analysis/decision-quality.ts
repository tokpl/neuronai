import type { DecisionQualityRecord } from '../types.js';
import { clamp01, round2 } from '../types.js';

/**
 * Tracks recommended vs actual developer choice vs long-term result.
 * Connects conceptually to Decision Engine feedback — no auto training.
 */
export class DecisionQualityTracker {
  private records: DecisionQualityRecord[] = [];

  load(records: DecisionQualityRecord[]): void {
    this.records = [...records];
  }

  list(): DecisionQualityRecord[] {
    return [...this.records];
  }

  record(input: {
    decisionId: string;
    recommended: string;
    actualChoice?: string;
    longTermResult?: 'good' | 'bad' | 'unknown';
  }): DecisionQualityRecord {
    let score = 0.5;
    if (input.actualChoice) {
      const aligned =
        input.actualChoice.toLowerCase().includes(input.recommended.toLowerCase().slice(0, 24)) ||
        input.recommended.toLowerCase().includes(input.actualChoice.toLowerCase().slice(0, 24));
      score = aligned ? 0.8 : 0.35;
    }
    if (input.longTermResult === 'good') score = clamp01(score + 0.15);
    if (input.longTermResult === 'bad') score = clamp01(score - 0.25);

    const row: DecisionQualityRecord = {
      decisionId: input.decisionId,
      recommended: input.recommended.slice(0, 200),
      actualChoice: input.actualChoice?.slice(0, 200),
      longTermResult: input.longTermResult ?? 'unknown',
      score: round2(score),
    };
    this.records = [row, ...this.records.filter((r) => r.decisionId !== row.decisionId)];
    return row;
  }

  averageScore(): number {
    if (!this.records.length) return 0;
    return round2(this.records.reduce((s, r) => s + r.score, 0) / this.records.length);
  }
}

export function createDecisionQualityTracker(): DecisionQualityTracker {
  return new DecisionQualityTracker();
}

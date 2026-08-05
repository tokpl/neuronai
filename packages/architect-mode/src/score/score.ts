import type { ArchitectureScoreSnapshot, ImplementationReview, RiskAnalysis } from '../types.js';

/**
 * Architecture score 0–100 before/after a change.
 */
export class ArchitectureScore {
  compare(input: {
    before?: number;
    review?: ImplementationReview;
    risk?: RiskAnalysis;
    betterSeparation?: boolean;
  }): ArchitectureScoreSnapshot {
    const before = input.before ?? 72;
    let after = before;
    if (input.review) {
      after =
        40 * input.review.architectureCompliance +
        30 * input.review.planCompliance +
        30 * ((100 - (input.review.issues.length + input.review.brokenPatterns.length) * 8) / 100);
      after = Math.round(Math.max(0, Math.min(100, after)));
    } else if (input.betterSeparation) {
      after = Math.min(100, before + 12);
    } else if (input.risk?.level === 'HIGH') {
      after = Math.max(0, before - 5);
    }

    const reason =
      after > before
        ? 'Better module separation / higher plan compliance'
        : after < before
          ? 'New risks or architecture deviations detected'
          : 'No significant architecture score change';

    return { before, after, delta: after - before, reason };
  }
}

export function createArchitectureScore(): ArchitectureScore {
  return new ArchitectureScore();
}

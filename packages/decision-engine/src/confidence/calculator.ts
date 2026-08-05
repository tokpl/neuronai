import type { DecisionFeedback, EvidenceItem } from '../types.js';

/**
 * Confidence from evidence quality — transparent weights, not a black box.
 */
export class ConfidenceCalculator {
  calculate(input: {
    evidence: EvidenceItem[];
    feedback?: DecisionFeedback[];
    historicalCorrectness?: number;
  }): number {
    const evidence = input.evidence;
    if (!evidence.length) return 0.35;

    const memoryReliability = avg(
      evidence.filter((e) => e.kind === 'memory' || e.kind === 'decision').map((e) => e.weight),
    );
    const sourceQuality = avg(evidence.map((e) => e.weight));
    const freshness = freshnessProxy(evidence);
    const graphConnections = evidence.some((e) => e.kind === 'graph' || e.kind === 'code')
      ? 0.75
      : 0.45;
    const historical =
      input.historicalCorrectness ??
      feedbackScore(input.feedback ?? []);

    const score =
      memoryReliability * 0.25 +
      sourceQuality * 0.25 +
      freshness * 0.15 +
      graphConnections * 0.15 +
      historical * 0.2;

    return clamp(Math.round(score * 1000) / 1000);
  }
}

function avg(nums: number[]): number {
  if (!nums.length) return 0.5;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function freshnessProxy(evidence: EvidenceItem[]): number {
  // Heuristic: incidents/rules/decisions imply fresher governance than bare memories
  if (evidence.some((e) => e.kind === 'rule' || e.kind === 'incident')) return 0.8;
  if (evidence.some((e) => e.kind === 'decision')) return 0.7;
  return 0.55;
}

function feedbackScore(feedback: DecisionFeedback[]): number {
  if (!feedback.length) return 0.6;
  let score = 0.6;
  for (const f of feedback.slice(0, 20)) {
    if (f.label === 'HELPFUL') score += 0.05;
    if (f.label === 'PARTIALLY_CORRECT') score += 0.01;
    if (f.label === 'WRONG') score -= 0.08;
  }
  return clamp(score);
}

function clamp(n: number): number {
  return Math.max(0.05, Math.min(0.99, n));
}

export function createConfidenceCalculator(): ConfidenceCalculator {
  return new ConfidenceCalculator();
}

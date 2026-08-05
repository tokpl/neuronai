import { redactSecrets } from '@neuron-ai-memory/security';

import type { EvaluationCriterion, QualityMetrics } from '../types.js';
import { clamp01, round2 } from '../types.js';

/** Sanitize text before persistence — never store secrets or huge prompts. */
export function sanitizeEvalText(text: string, max = 400): string {
  return redactSecrets(text).replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * QualityMetrics — accuracy, relevance, completeness, confidence, consistency.
 */
export class QualityMetricsCalculator {
  compute(input: {
    answer: string;
    expectedKeywords?: string[];
    unexpectedKeywords?: string[];
    evidenceSnippets?: string[];
    projectFacts?: string[];
    claimedConfidence?: number;
  }): { metrics: QualityMetrics; criteria: EvaluationCriterion[]; evidence: string[] } {
    const answer = input.answer.toLowerCase();
    const expected = input.expectedKeywords ?? [];
    const unexpected = input.unexpectedKeywords ?? [];
    const evidenceSnippets = input.evidenceSnippets ?? [];
    const projectFacts = input.projectFacts ?? [];

    const hitExpected = expected.filter((k) => answer.includes(k.toLowerCase()));
    const hitUnexpected = unexpected.filter((k) => answer.includes(k.toLowerCase()));
    const accuracy = expected.length
      ? clamp01(hitExpected.length / expected.length - hitUnexpected.length * 0.15)
      : evidenceSnippets.length
        ? 0.7
        : 0.45;

    const relevance = expected.length
      ? clamp01(hitExpected.length / Math.max(1, expected.length))
      : clamp01(0.4 + Math.min(0.4, answer.length / 800));

    const completeness = expected.length
      ? clamp01(hitExpected.length / expected.length)
      : clamp01(Math.min(1, answer.split(/[.!?]/).filter((s) => s.trim().length > 20).length / 4));

    const evidenceCoverage =
      evidenceSnippets.length === 0
        ? 0.5
        : clamp01(
            evidenceSnippets.filter((e) =>
              answer.includes(e.toLowerCase().slice(0, 24)),
            ).length / evidenceSnippets.length,
          );

    const consistency =
      projectFacts.length === 0
        ? 0.65
        : clamp01(
            projectFacts.filter((f) => answer.includes(f.toLowerCase().slice(0, 20))).length /
              projectFacts.length ||
              (hitUnexpected.length ? 0.3 : 0.7),
          );

    const claimed = input.claimedConfidence ?? completeness;
    const confidence = clamp01(1 - Math.abs(claimed - accuracy) * 0.8);

    const overall = round2(
      0.25 * accuracy +
        0.2 * relevance +
        0.2 * completeness +
        0.15 * confidence +
        0.2 * consistency,
    );

    const metrics: QualityMetrics = {
      accuracy: round2(accuracy),
      relevance: round2(relevance),
      completeness: round2(completeness),
      confidence: round2(confidence),
      consistency: round2(Math.max(consistency, evidenceCoverage * 0.5)),
      overall,
    };

    const criteria: EvaluationCriterion[] = [
      { name: 'accuracy', score: metrics.accuracy, note: `${hitExpected.length}/${expected.length || '?'} expected keywords` },
      { name: 'relevance', score: metrics.relevance },
      { name: 'completeness', score: metrics.completeness },
      { name: 'confidence', score: metrics.confidence },
      { name: 'consistency', score: metrics.consistency },
    ];

    const evidence = [
      ...hitExpected.map((k) => `matched:${k}`),
      ...hitUnexpected.map((k) => `noise:${k}`),
      ...evidenceSnippets.slice(0, 5).map((e) => `evidence:${e.slice(0, 80)}`),
    ];

    return { metrics, criteria, evidence };
  }
}

export function createQualityMetricsCalculator(): QualityMetricsCalculator {
  return new QualityMetricsCalculator();
}

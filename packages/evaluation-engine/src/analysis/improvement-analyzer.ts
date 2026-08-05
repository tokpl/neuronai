import type {
  EvaluationResult,
  FeedbackEntry,
  ImprovementSuggestion,
  RetrievalEvalResult,
} from '../types.js';

/**
 * ImprovementAnalyzer — measurement → configuration suggestions.
 * Never trains models.
 */
export class ImprovementAnalyzer {
  analyze(input: {
    evaluations: EvaluationResult[];
    retrieval?: RetrievalEvalResult[];
    feedback?: FeedbackEntry[];
  }): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const evals = input.evaluations;
    const avgRelevance =
      evals.reduce((s, e) => s + e.metrics.relevance, 0) / Math.max(1, evals.length);
    const avgCompleteness =
      evals.reduce((s, e) => s + e.metrics.completeness, 0) / Math.max(1, evals.length);
    const avgConsistency =
      evals.reduce((s, e) => s + e.metrics.consistency, 0) / Math.max(1, evals.length);

    const lowRetrieval = (input.retrieval ?? []).filter((r) => r.score === 'LOW');
    if (lowRetrieval.length >= 1) {
      suggestions.push({
        problem: 'Retrieval often misses relevant memories (e.g. database / auth).',
        suggestion:
          'Increase ranking weight for matching tags/modules; expand gold titles in .neuron/benchmarks/.',
        area: 'retrieval',
        priority: 'high',
      });
    }

    if (avgRelevance < 0.55 && evals.length) {
      suggestions.push({
        problem: 'Answers often use the wrong context.',
        suggestion: 'Tighten task-profile routing and prefer TEAM APPROVED memories in retrieval.',
        area: 'routing',
        priority: 'high',
      });
    }

    if (avgCompleteness < 0.55 && evals.length) {
      suggestions.push({
        problem: 'Answers miss important project facts.',
        suggestion: 'Raise context budget for ARCHITECTURE_REASONING; ensure ADRs are APPROVED.',
        area: 'memory',
        priority: 'medium',
      });
    }

    if (avgConsistency < 0.5 && evals.length) {
      suggestions.push({
        problem: 'Answers disagree with known project standards.',
        suggestion: 'Surface constitution / team rules earlier in context assembly.',
        area: 'decisions',
        priority: 'medium',
      });
    }

    const missing = (input.feedback ?? []).filter((f) => f.label === 'Missing context').length;
    const wrong = (input.feedback ?? []).filter((f) => f.label === 'Wrong').length;
    if (missing >= 2) {
      suggestions.push({
        problem: 'Developers report missing context frequently.',
        suggestion: 'Add project-specific cases under .neuron/benchmarks/ and re-run neuron_benchmark.',
        area: 'benchmarks',
        priority: 'medium',
      });
    }
    if (wrong >= 2) {
      suggestions.push({
        problem: 'Multiple Wrong feedback labels.',
        suggestion: 'Review hallucination warnings and demote low MemoryQualityScore records.',
        area: 'memory',
        priority: 'high',
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        problem: 'No major quality issues detected from recent samples.',
        suggestion: 'Keep collecting feedback labels and run benchmarks after large memory changes.',
        area: 'benchmarks',
        priority: 'low',
      });
    }

    return suggestions;
  }
}

export function createImprovementAnalyzer(): ImprovementAnalyzer {
  return new ImprovementAnalyzer();
}

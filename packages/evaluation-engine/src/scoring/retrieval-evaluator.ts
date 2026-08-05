import type { RetrievalEvalInput, RetrievalEvalResult } from '../types.js';
import { clamp01, round2 } from '../types.js';

/**
 * RetrievalEvaluator — precision / recall / ranking quality for memory hits.
 * Example: query "How authentication works?" expecting auth memories but
 * receiving unrelated frontend → score LOW.
 */
export class NeuronRetrievalEvaluator {
  evaluate(input: RetrievalEvalInput): RetrievalEvalResult {
    const retrieved = input.retrievedTitles.map((t) => t.toLowerCase());
    const expected = (input.expectedTitles ?? []).map((t) => t.toLowerCase());
    const expectedIds = new Set(input.expectedIds ?? []);

    let tp = 0;
    if (expectedIds.size && input.retrievedIds?.length) {
      tp = input.retrievedIds.filter((id) => expectedIds.has(id)).length;
    } else if (expected.length) {
      tp = retrieved.filter((t) =>
        expected.some((e) => t.includes(e) || e.includes(t)),
      ).length;
    }

    const precision = retrieved.length ? tp / retrieved.length : 0;
    const recall =
      expected.length || expectedIds.size
        ? tp / Math.max(1, expected.length || expectedIds.size)
        : 0;
    const topRelevant =
      retrieved[0] &&
      expected.some((e) => retrieved[0]!.includes(e) || e.includes(retrieved[0]!));
    const rankingQuality = clamp01(
      precision * 0.5 + recall * 0.3 + (topRelevant ? 0.2 : 0),
    );

    const scoreNum = round2(0.4 * precision + 0.4 * recall + 0.2 * rankingQuality);
    const score: RetrievalEvalResult['score'] =
      scoreNum >= 0.75 ? 'HIGH' : scoreNum >= 0.45 ? 'MEDIUM' : 'LOW';

    const evidence: string[] = [];
    if (score === 'LOW') {
      evidence.push(
        `Query "${input.query}" expected [${expected.join(', ') || 'relevant memories'}] but received [${retrieved.join(', ') || 'none'}]`,
      );
    }

    return {
      precision: round2(precision),
      recall: round2(recall),
      rankingQuality: round2(rankingQuality),
      score,
      summary: `precision=${round2(precision)} recall=${round2(recall)} ranking=${round2(rankingQuality)} → ${score}`,
      evidence,
    };
  }
}

export function createNeuronRetrievalEvaluator(): NeuronRetrievalEvaluator {
  return new NeuronRetrievalEvaluator();
}

import type { EvaluationSnapshot } from '../types.js';
import { nowIso } from '../types.js';

/**
 * Tracks whether retrieval / memory quality improves over runs (local in-memory).
 */
export class EvaluationHistory {
  private readonly snapshots: EvaluationSnapshot[] = [];

  record(snapshot: Omit<EvaluationSnapshot, 'at'> & { at?: string }): EvaluationSnapshot {
    const row: EvaluationSnapshot = { ...snapshot, at: snapshot.at ?? nowIso() };
    this.snapshots.push(row);
    return row;
  }

  list(): EvaluationSnapshot[] {
    return [...this.snapshots];
  }

  trend(): {
    retrievalImproving: boolean | null;
    memoryQualityImproving: boolean | null;
    latest?: EvaluationSnapshot;
    previous?: EvaluationSnapshot;
  } {
    if (this.snapshots.length < 2) {
      return {
        retrievalImproving: null,
        memoryQualityImproving: null,
        latest: this.snapshots[this.snapshots.length - 1],
      };
    }
    const previous = this.snapshots[this.snapshots.length - 2]!;
    const latest = this.snapshots[this.snapshots.length - 1]!;
    return {
      previous,
      latest,
      retrievalImproving: latest.retrievalP50Ms <= previous.retrievalP50Ms,
      memoryQualityImproving: latest.memoryQualityAccuracy >= previous.memoryQualityAccuracy,
    };
  }
}

export function createEvaluationHistory(): EvaluationHistory {
  return new EvaluationHistory();
}

import type { ModeEvaluationSnapshot, ModeId, ModeUsageRecord } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Remembers which modes help and which outputs were useful.
 */
export class ModeUsageMemory {
  private usage: ModeUsageRecord[] = [];

  load(records: ModeUsageRecord[]): void {
    this.usage = [...records];
  }

  snapshot(): ModeUsageRecord[] {
    return [...this.usage];
  }

  record(input: {
    modeId: ModeId;
    query: string;
    useful?: boolean;
    feedback?: string;
    accuracyHint?: number;
  }): ModeUsageRecord {
    const entry: ModeUsageRecord = {
      id: newId('muse'),
      modeId: input.modeId,
      query: input.query.slice(0, 300),
      at: nowIso(),
      useful: input.useful,
      feedback: input.feedback?.slice(0, 400),
      accuracyHint: input.accuracyHint,
    };
    this.usage.unshift(entry);
    this.usage = this.usage.slice(0, 300);
    return entry;
  }

  /**
   * Evaluation bridge — usefulness / accuracy / feedback (local metrics).
   */
  evaluate(modeId?: ModeId): ModeEvaluationSnapshot[] {
    const ids = modeId
      ? [modeId]
      : ([...new Set(this.usage.map((u) => u.modeId))] as ModeId[]);

    return ids.map((id) => {
      const rows = this.usage.filter((u) => u.modeId === id);
      const rated = rows.filter((u) => u.useful !== undefined);
      const usefulCount = rated.filter((u) => u.useful).length;
      const accuracy = rows
        .map((u) => u.accuracyHint)
        .filter((n): n is number => typeof n === 'number');
      const avgAccuracyHint = accuracy.length
        ? accuracy.reduce((a, b) => a + b, 0) / accuracy.length
        : 0;
      return {
        modeId: id,
        runs: rows.length,
        usefulCount,
        usefulnessRate: rated.length ? usefulCount / rated.length : 0,
        avgAccuracyHint,
        developerFeedback: rows
          .map((u) => u.feedback)
          .filter((f): f is string => Boolean(f))
          .slice(0, 10),
      };
    });
  }
}

export function createModeUsageMemory(): ModeUsageMemory {
  return new ModeUsageMemory();
}

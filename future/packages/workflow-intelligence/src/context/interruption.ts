import type { InterruptionRecord } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Remember interrupted technical work — why / what changed / what remains risky.
 */
export class InterruptionMemory {
  private records: InterruptionRecord[] = [];

  load(records: InterruptionRecord[]): void {
    this.records = [...records];
  }

  list(): InterruptionRecord[] {
    return [...this.records];
  }

  latest(): InterruptionRecord | undefined {
    return this.records[0];
  }

  record(input: {
    whyStarted: string;
    whatChanged?: string[];
    whatRemainsRisky?: string[];
    activeArea: string;
  }): InterruptionRecord {
    const rec: InterruptionRecord = {
      id: newId('int'),
      whyStarted: input.whyStarted,
      whatChanged: input.whatChanged ?? [],
      whatRemainsRisky: input.whatRemainsRisky ?? [],
      activeArea: input.activeArea,
      pausedAt: nowIso(),
    };
    this.records.unshift(rec);
    if (this.records.length > 50) this.records.length = 50;
    return rec;
  }
}

export function createInterruptionMemory(): InterruptionMemory {
  return new InterruptionMemory();
}

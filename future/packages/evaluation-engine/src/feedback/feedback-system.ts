import { redactSecrets } from '@neuron-ai-memory/security';

import type { FeedbackEntry, FeedbackLabel } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Developer feedback loop — Helpful / Wrong / Missing context / Needs improvement.
 * Never stores emotions or private data.
 */
export class FeedbackSystem {
  private entries: FeedbackEntry[] = [];

  load(entries: FeedbackEntry[]): void {
    this.entries = [...entries];
  }

  list(limit = 50): FeedbackEntry[] {
    return [...this.entries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  record(input: {
    label: FeedbackLabel;
    note?: string;
    task?: string;
    evaluationId?: string;
  }): FeedbackEntry {
    const entry: FeedbackEntry = {
      id: newId('fb'),
      label: input.label,
      note: input.note ? redactSecrets(input.note).slice(0, 200) : undefined,
      task: input.task ? redactSecrets(input.task).slice(0, 120) : undefined,
      evaluationId: input.evaluationId,
      at: nowIso(),
    };
    this.entries.unshift(entry);
    return entry;
  }

  helpfulRate(): number {
    if (!this.entries.length) return 0;
    const helpful = this.entries.filter((e) => e.label === 'Helpful').length;
    return helpful / this.entries.length;
  }

  counts(): Record<FeedbackLabel, number> {
    const base: Record<FeedbackLabel, number> = {
      Helpful: 0,
      Wrong: 0,
      'Missing context': 0,
      'Needs improvement': 0,
    };
    for (const e of this.entries) base[e.label] += 1;
    return base;
  }
}

export function createFeedbackSystem(): FeedbackSystem {
  return new FeedbackSystem();
}

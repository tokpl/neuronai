import { findDuplicate, similarity } from '@neuronai/brain';
import type { MemoryRecord, MemoryType } from '@neuronai/types';

export interface QualityCheckInput {
  title: string;
  content: string;
  type: MemoryType;
  confidence: number;
  existing: MemoryRecord[];
}

export interface QualityCheckResult {
  ok: boolean;
  issues: string[];
  recommendation: 'accept' | 'reject' | 'ask_user';
  duplicateOf?: MemoryRecord;
}

/** Near-duplicate threshold for suggestions — looser than the storage dedupe gate. */
const SUGGESTION_DUPLICATE_THRESHOLD = 0.72;

/**
 * Gate suggestions before they become memories.
 * Duplicate detection uses the same engine as storage, so the two never disagree.
 */
export class MemoryQualityChecker {
  check(input: QualityCheckInput): QualityCheckResult {
    const issues: string[] = [];

    if (input.confidence < 0.4) issues.push('low confidence');
    if (input.title.trim().length < 4) issues.push('title too short');
    if (input.content.trim().length < 12) issues.push('content too short');

    const active = input.existing.filter((m) => m.status === 'active');
    const candidate = { type: input.type, title: input.title, content: input.content };

    const exact = findDuplicate(candidate, active);
    let duplicateOf: MemoryRecord | undefined = exact?.existing;

    if (!duplicateOf) {
      for (const memory of active) {
        if (similarity(candidate, memory) >= SUGGESTION_DUPLICATE_THRESHOLD) {
          duplicateOf = memory;
          break;
        }
      }
    }

    if (duplicateOf) {
      issues.push(`already known as "${duplicateOf.title}"`);
      return { ok: false, issues, recommendation: 'reject', duplicateOf };
    }

    if (input.confidence < 0.4 || issues.includes('content too short')) {
      return { ok: false, issues, recommendation: 'reject' };
    }

    return {
      ok: issues.length === 0,
      issues,
      recommendation: issues.length ? 'ask_user' : 'accept',
    };
  }
}

export function createMemoryQualityChecker(): MemoryQualityChecker {
  return new MemoryQualityChecker();
}

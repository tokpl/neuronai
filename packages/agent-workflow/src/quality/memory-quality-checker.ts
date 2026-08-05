import { ConflictDetector, jaccardSimilarity } from '@neuronai/ai-memory';
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
  recommendation: 'accept' | 'reject' | 'ask_user' | 'supersede';
  duplicateOf?: MemoryRecord;
}

/**
 * Gate suggestions before they become memories - duplicate / low confidence / conflicts.
 */
export class MemoryQualityChecker {
  private readonly conflicts = new ConflictDetector();

  check(input: QualityCheckInput): QualityCheckResult {
    const issues: string[] = [];

    if (input.confidence < 0.4) {
      issues.push('low confidence');
    }
    if (input.title.trim().length < 4) {
      issues.push('title too short');
    }
    if (input.content.trim().length < 12) {
      issues.push('content too short');
    }

    let duplicateOf: MemoryRecord | undefined;
    for (const memory of input.existing) {
      if (memory.status !== 'active') continue;
      const score = Math.max(
        jaccardSimilarity(input.title, memory.title),
        jaccardSimilarity(input.content, memory.content),
      );
      if (score >= 0.72) {
        duplicateOf = memory;
        issues.push(`likely duplicate of "${memory.title}"`);
        break;
      }
    }

    const conflict = this.conflicts.detect(
      {
        type: input.type,
        title: input.title,
        content: input.content,
        confidence: input.confidence,
        sourceHint: 'agent',
      },
      input.existing,
    );

    if (conflict.kind === 'contradiction') {
      issues.push(`possible conflict: ${conflict.rationale}`);
    }

    // Outdated: existing high-importance memory on same topic older than draft supersede path
    if (conflict.kind === 'migration' || conflict.recommendation === 'supersede') {
      issues.push('may supersede outdated memory');
    }

    if (duplicateOf) {
      return {
        ok: false,
        issues,
        recommendation: 'reject',
        duplicateOf,
      };
    }

    if (input.confidence < 0.4 || issues.includes('content too short')) {
      return { ok: false, issues, recommendation: 'reject' };
    }

    if (conflict.kind === 'contradiction' || conflict.recommendation === 'ask_user') {
      return { ok: false, issues, recommendation: 'ask_user', duplicateOf: conflict.existing };
    }

    if (conflict.recommendation === 'supersede') {
      return { ok: true, issues, recommendation: 'supersede', duplicateOf: conflict.existing };
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

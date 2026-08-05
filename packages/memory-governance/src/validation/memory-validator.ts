import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { ValidationResult } from '../types.js';

/**
 * MemoryValidator — validates memories against code / developer / tests / git signals.
 * Example: "Payment uses Stripe" validated by source filenames mentioning stripe.
 */
export class MemoryValidator {
  validate(
    memory: MemoryRecord,
    ctx: {
      codeSignals?: string[];
      testMentions?: string[];
      gitSubjects?: string[];
      developerApproved?: boolean;
    } = {},
  ): ValidationResult {
    const sources: ValidationResult['sources'] = [];
    const evidence: string[] = [];
    const blob = `${memory.title} ${memory.content}`.toLowerCase();
    const tokens = blob
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3)
      .slice(0, 12);

    const code = (ctx.codeSignals ?? []).map((c) => c.toLowerCase());
    const codeHit = tokens.some((t) => code.some((c) => c.includes(t) || t.includes(c.replace(/\.[a-z]+$/, ''))));
    if (codeHit) {
      sources.push('code');
      evidence.push('Matched code/file signal');
    }

    const tests = (ctx.testMentions ?? []).map((t) => t.toLowerCase());
    if (tokens.some((t) => tests.some((x) => x.includes(t)))) {
      sources.push('tests');
      evidence.push('Matched test mention');
    }

    const git = (ctx.gitSubjects ?? []).map((g) => g.toLowerCase());
    if (tokens.some((t) => git.some((g) => g.includes(t)))) {
      sources.push('git');
      evidence.push('Matched git history subject');
    }

    if (ctx.developerApproved || memory.source === 'manual') {
      sources.push('developer');
      evidence.push(ctx.developerApproved ? 'Developer approval' : 'Manual source');
    }

    if (!sources.length && memory.confidenceScore >= 0.75 && memory.usageCount > 0) {
      sources.push('heuristic');
      evidence.push('High confidence + usage (heuristic)');
    }

    const valid = sources.length > 0 && !['archived', 'superseded'].includes(memory.status);
    return {
      memoryId: memory.id,
      valid,
      sources,
      evidence,
      lifecycleHint: valid ? 'VALIDATED' : memory.status === 'archived' ? 'ARCHIVED' : undefined,
    };
  }

  validateMany(
    memories: MemoryRecord[],
    ctx: {
      codeSignals?: string[];
      testMentions?: string[];
      gitSubjects?: string[];
    } = {},
  ): ValidationResult[] {
    return memories.map((m) => this.validate(m, ctx));
  }
}

export function createMemoryValidator(): MemoryValidator {
  return new MemoryValidator();
}

import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { ReviewPriority, StaleSignal } from '../types.js';
import { daysSince } from '../types.js';

const SUPERSEDED_TECH: Array<{ old: RegExp; modernHint: RegExp; label: string }> = [
  { old: /\bredux\b/i, modernHint: /\bzustand\b|jotai|recoil/i, label: 'Redux' },
  { old: /\bmysql\b/i, modernHint: /\bpostgres/i, label: 'MySQL' },
  { old: /\bmongodb\b/i, modernHint: /\bpostgres/i, label: 'MongoDB' },
  { old: /\brest\b/i, modernHint: /\bgraphql\b/i, label: 'REST-only' },
  { old: /\benzyme\b/i, modernHint: /\btesting-library|vitest|jest\b/i, label: 'Enzyme' },
];

/**
 * Detects outdated / unused / superseded memories. Suggestions only.
 */
export class StaleMemoryDetector {
  detect(
    memories: MemoryRecord[],
    options: { codeSignals?: string[]; now?: Date } = {},
  ): StaleSignal[] {
    const now = options.now ?? new Date();
    const codeBlob = (options.codeSignals ?? []).join('\n').toLowerCase();
    const signals: StaleSignal[] = [];

    for (const m of memories) {
      if (m.status !== 'active') continue;
      const blob = `${m.title}\n${m.content}`;
      const evidence: string[] = [];
      let priority: ReviewPriority = 'medium';

      for (const tech of SUPERSEDED_TECH) {
        if (!tech.old.test(blob)) continue;
        const mentionedInCode = tech.old.test(codeBlob);
        const modernInCode = tech.modernHint.test(codeBlob);
        if (!mentionedInCode && (modernInCode || codeBlob.length > 0)) {
          evidence.push(
            `Memory mentions ${tech.label}, but code signals show no ${tech.label} usage` +
              (modernInCode ? ' (modern alternative present)' : ''),
          );
          priority = 'high';
        }
      }

      const unusedDays = daysSince(m.lastUsedAt ?? m.updatedAt, now);
      if (m.usageCount === 0 && unusedDays > 90) {
        evidence.push(`No recorded usage for ${Math.round(unusedDays)} days`);
        priority = priority === 'high' ? 'high' : 'medium';
      }

      const ageDays = daysSince(m.updatedAt, now);
      if (m.type === 'architecture_decision' && ageDays > 180 && unusedDays > 90) {
        evidence.push(`Architecture decision aging (${Math.round(ageDays)}d since update)`);
        priority = 'high';
      }

      // Dead module: memory names a module that never appears in code signals
      const moduleMatch = blob.match(/\b(?:module|package|service)\s+([A-Za-z][\w/-]+)/i);
      if (moduleMatch && codeBlob.length > 20) {
        const mod = moduleMatch[1]!.toLowerCase();
        if (!codeBlob.includes(mod) && !codeBlob.includes(mod.replace(/-/g, ''))) {
          evidence.push(`Referenced module/service "${moduleMatch[1]}" not seen in code signals`);
        }
      }

      if (evidence.length) {
        signals.push({
          memoryId: m.id,
          reason: 'Possible stale memory',
          evidence,
          priority,
        });
      }
    }

    return signals;
  }
}

export function createStaleMemoryDetector(): StaleMemoryDetector {
  return new StaleMemoryDetector();
}

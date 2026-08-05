import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { DuplicateSuggestion } from '../types.js';

/**
 * Lightweight semantic duplicate detection via token Jaccard + synonym boosts.
 * Suggests merge only — never mutates.
 */
export class DuplicateMemoryDetector {
  detect(memories: MemoryRecord[], minSimilarity = 0.55): DuplicateSuggestion[] {
    const active = memories.filter((m) => m.status === 'active');
    const out: DuplicateSuggestion[] = [];

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]!;
        const b = active[j]!;
        const similarity = similarityScore(a, b);
        if (similarity < minSimilarity) continue;
        out.push({
          leftId: a.id,
          rightId: b.id,
          leftTitle: a.title,
          rightTitle: b.title,
          similarity,
          suggestedAction: 'merge',
          mergeHint: `Merge into a single memory covering: ${a.title} / ${b.title}`,
          why: `Why merge: high overlap (${(similarity * 100).toFixed(0)}%) — likely the same fact phrased differently.`,
          requiresApproval: true,
        });
      }
    }

    return out.sort((x, y) => y.similarity - x.similarity);
  }
}

const SYNONYM_GROUPS = [
  ['auth', 'authentication', 'authenticated', 'middleware'],
  ['api', 'endpoint', 'apis', 'endpoints'],
  ['require', 'requires', 'required', 'every', 'all', 'must'],
  ['database', 'db', 'postgres', 'postgresql'],
];

function tokenize(text: string): Set<string> {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  const tokens = new Set<string>();
  for (const t of raw) {
    tokens.add(t);
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(t)) for (const g of group) tokens.add(g);
    }
  }
  return tokens;
}

function similarityScore(a: MemoryRecord, b: MemoryRecord): number {
  const ta = tokenize(`${a.title} ${a.content}`);
  const tb = tokenize(`${b.title} ${b.content}`);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / Math.max(1, union);
  const sameType = a.type === b.type ? 0.08 : 0;
  return Math.min(1, jaccard + sameType);
}

export function createDuplicateMemoryDetector(): DuplicateMemoryDetector {
  return new DuplicateMemoryDetector();
}

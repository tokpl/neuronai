import type { MemoryRecord } from '@neuronai/types';

import type { ExtractedMemoryCandidate } from '../extractor/memory-extractor.js';

export type ConflictKind = 'none' | 'duplicate' | 'contradiction' | 'migration';

export interface ConflictReport {
  kind: ConflictKind;
  existing?: MemoryRecord;
  similarity: number;
  recommendation: 'create' | 'skip' | 'supersede' | 'ask_user';
  rationale: string;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const sa = tokenize(a);
  const sb = tokenize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

const CONTRADICTION_PAIRS: Array<[RegExp, RegExp]> = [
  [/redux/i, /zustand|jotai|recoil/i],
  [/mongodb|mongo\b/i, /postgres|postgresql|mysql/i],
  [/rest\b/i, /graphql/i],
  [/npm\b/i, /pnpm|yarn/i],
];

export class ConflictDetector {
  detect(candidate: ExtractedMemoryCandidate, existing: MemoryRecord[]): ConflictReport {
    let best: { memory: MemoryRecord; score: number } | undefined;

    for (const memory of existing) {
      if (memory.status !== 'active') continue;
      const score = Math.max(
        jaccardSimilarity(candidate.title, memory.title),
        jaccardSimilarity(candidate.content, memory.content),
      );
      if (!best || score > best.score) best = { memory, score };
    }

    if (!best || best.score < 0.25) {
      return {
        kind: 'none',
        similarity: best?.score ?? 0,
        recommendation: 'create',
        rationale: 'no overlapping active memory',
      };
    }

    const migration = detectsMigration(best.memory.content, candidate.content);
    if (migration) {
      return {
        kind: 'migration',
        existing: best.memory,
        similarity: best.score,
        recommendation: 'supersede',
        rationale: 'detected technology/stack migration',
      };
    }

    const contradiction = detectsContradiction(best.memory.content, candidate.content);
    if (contradiction && best.score >= 0.35) {
      return {
        kind: 'contradiction',
        existing: best.memory,
        similarity: best.score,
        recommendation: 'ask_user',
        rationale: 'possible conflicting truths',
      };
    }

    if (best.score >= 0.85) {
      return {
        kind: 'duplicate',
        existing: best.memory,
        similarity: best.score,
        recommendation: 'skip',
        rationale: 'near-duplicate of existing memory',
      };
    }

    return {
      kind: 'none',
      existing: best.memory,
      similarity: best.score,
      recommendation: 'create',
      rationale: 'related but compatible',
    };
  }
}

function detectsMigration(oldText: string, newText: string): boolean {
  const migrated = /migrat|moved to|switching to|replaced with|now uses/i.test(newText);
  if (!migrated) return false;
  return detectsContradiction(oldText, newText);
}

function detectsContradiction(a: string, b: string): boolean {
  for (const [left, right] of CONTRADICTION_PAIRS) {
    const aLeft = left.test(a);
    const aRight = right.test(a);
    const bLeft = left.test(b);
    const bRight = right.test(b);
    if ((aLeft && bRight) || (aRight && bLeft)) return true;
  }
  return false;
}

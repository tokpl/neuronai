import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { ConflictResolutionSuggestion } from '../types.js';

/**
 * Detect contradictory decisions and propose supersede resolutions.
 * Never applies changes — requiresApproval is always true.
 */
export class ConflictResolver {
  resolve(memories: MemoryRecord[]): ConflictResolutionSuggestion[] {
    const decisions = memories.filter(
      (m) =>
        m.status === 'active' &&
        (m.type === 'architecture_decision' || /decision/i.test(m.title)),
    );
    const out: ConflictResolutionSuggestion[] = [];

    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        const a = decisions[i]!;
        const b = decisions[j]!;
        if (!topicallyRelated(a, b)) continue;
        if (!contradicts(a, b)) continue;

        const newer = newerOf(a, b);
        const older = newer.id === a.id ? b : a;
        const topic = sharedTopic(a, b);

        out.push({
          topic,
          olderId: older.id,
          newerId: newer.id,
          olderTitle: older.title,
          newerTitle: newer.title,
          resolution: `${older.title} decision superseded by "${newer.title}".`,
          suggestedAction: 'supersede',
          why: `Why: ${topic} decisions conflict ("${older.title}" vs "${newer.title}"). Prefer the newer/updated record; mark the older as historical after approval.`,
          requiresApproval: true,
        });
      }
    }

    return out;
  }
}

function text(m: MemoryRecord): string {
  return `${m.title} ${m.content}`;
}

function topicallyRelated(a: MemoryRecord, b: MemoryRecord): boolean {
  const ha = text(a).toLowerCase();
  const hb = text(b).toLowerCase();
  const pairs: Array<[RegExp, RegExp]> = [
    [/\brest\b/, /\bgraphql\b/],
    [/\bmysql\b/, /\bpostgres/],
    [/\bmongodb\b/, /\bpostgres/],
    [/\bredux\b/, /\bzustand\b/],
  ];
  if (pairs.some(([x, y]) => (x.test(ha) && y.test(hb)) || (y.test(ha) && x.test(hb)))) {
    return true;
  }
  const topics = ['rest', 'graphql', 'postgres', 'mysql', 'mongo', 'redux', 'zustand', 'auth'];
  return topics.some((t) => ha.includes(t) && hb.includes(t));
}

function contradicts(a: MemoryRecord, b: MemoryRecord): boolean {
  const pairs: Array<[RegExp, RegExp]> = [
    [/\brest\b/i, /\bgraphql\b/i],
    [/\bmysql\b/i, /\bpostgres/i],
    [/\bmongodb\b/i, /\bpostgres/i],
    [/\bredux\b/i, /\bzustand\b/i],
  ];
  const ta = text(a);
  const tb = text(b);
  return pairs.some(([x, y]) => (x.test(ta) && y.test(tb)) || (y.test(ta) && x.test(tb)));
}

function newerOf(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
  const ta = Date.parse(a.updatedAt) || 0;
  const tb = Date.parse(b.updatedAt) || 0;
  if (ta === tb) return a.importanceScore >= b.importanceScore ? a : b;
  return ta > tb ? a : b;
}

function sharedTopic(a: MemoryRecord, b: MemoryRecord): string {
  const hay = `${a.title} ${b.title}`.toLowerCase();
  if (/graphql|rest/.test(hay)) return 'API style';
  if (/postgres|mysql|mongo/.test(hay)) return 'Database';
  if (/zustand|redux/.test(hay)) return 'State management';
  return 'Architecture';
}

export function createConflictResolver(): ConflictResolver {
  return new ConflictResolver();
}

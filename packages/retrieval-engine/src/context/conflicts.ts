import type { ContextConflict, RankedHit } from '../types.js';

/**
 * Detect contradictory decisions — do not present both as current truth.
 */
export class ConflictAwareFilter {
  detect(hits: RankedHit[]): { conflicts: ContextConflict[]; filtered: RankedHit[] } {
    const decisions = hits.filter(
      (h) => h.source === 'decision' || h.type === 'architecture_decision' || /decision/i.test(h.title),
    );
    const conflicts: ContextConflict[] = [];
    const suppress = new Set<string>();

    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        const a = decisions[i]!;
        const b = decisions[j]!;
        if (!topicallyRelated(a, b)) continue;
        if (!contradicts(a.content, b.content) && !contradicts(a.title, b.title)) continue;

        const newer = newerHit(a, b);
        const older = newer.id === a.id ? b : a;
        conflicts.push({
          topic: sharedTopic(a, b),
          older: { title: older.title, content: older.content, at: older.updatedAt ?? older.createdAt },
          newer: { title: newer.title, content: newer.content, at: newer.updatedAt ?? newer.createdAt },
          message: 'Architecture changed. Prefer the newer decision; older is historical.',
        });
        suppress.add(older.id);
      }
    }

    const filtered = hits.filter((h) => !suppress.has(h.id));
    return { conflicts, filtered };
  }
}

function topicallyRelated(a: RankedHit, b: RankedHit): boolean {
  const ha = `${a.title} ${a.content}`.toLowerCase();
  const hb = `${b.title} ${b.content}`.toLowerCase();
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

function contradicts(a: string, b: string): boolean {
  const pairs: Array<[RegExp, RegExp]> = [
    [/\brest\b/i, /\bgraphql\b/i],
    [/\bmysql\b/i, /\bpostgres/i],
    [/\bmongodb\b/i, /\bpostgres/i],
    [/\bredux\b/i, /\bzustand\b/i],
    [/\buse rest\b/i, /\bmigrate to graphql\b/i],
  ];
  return pairs.some(
    ([x, y]) => (x.test(a) && y.test(b)) || (y.test(a) && x.test(b)),
  );
}

function newerHit(a: RankedHit, b: RankedHit): RankedHit {
  const ta = Date.parse(a.updatedAt ?? a.createdAt ?? '') || 0;
  const tb = Date.parse(b.updatedAt ?? b.createdAt ?? '') || 0;
  if (ta === tb) return a.finalScore >= b.finalScore ? a : b;
  return ta > tb ? a : b;
}

function sharedTopic(a: RankedHit, b: RankedHit): string {
  const hay = `${a.title} ${b.title}`.toLowerCase();
  if (/graphql|rest/.test(hay)) return 'API style';
  if (/postgres|mysql|mongo/.test(hay)) return 'Database';
  if (/zustand|redux/.test(hay)) return 'State management';
  return 'Architecture';
}

export function createConflictAwareFilter(): ConflictAwareFilter {
  return new ConflictAwareFilter();
}

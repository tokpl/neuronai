import type { RetrievalHit } from './rank.js';
import type { QueryIntent } from './intent.js';

/**
 * Keep high-value memory kinds in the shortlist when location docs would
 * otherwise crowd them out. Does not invent hits — only reorders / reserves
 * among already-matched candidates.
 */
export function diversifyRetrievalHits(
  hits: RetrievalHit[],
  intent: QueryIntent,
  limit: number,
): RetrievalHit[] {
  if (hits.length <= limit) return hits;

  const reservedKinds = new Set<string>();
  if (intent === 'CONVENTION' || intent === 'MODIFICATION' || intent === 'GENERAL_PROJECT') {
    reservedKinds.add('rule');
    reservedKinds.add('pattern');
  }
  if (
    intent === 'DECISION' ||
    intent === 'MODIFICATION' ||
    intent === 'ARCHITECTURE' ||
    intent === 'GENERAL_PROJECT'
  ) {
    reservedKinds.add('decision');
  }
  if (intent === 'DEBUGGING') {
    reservedKinds.add('warning');
    reservedKinds.add('rule');
  }

  const chosen: RetrievalHit[] = [];
  const used = new Set<string>();

  const take = (hit: RetrievalHit): void => {
    if (chosen.length >= limit || used.has(hit.doc.id)) return;
    chosen.push(hit);
    used.add(hit.doc.id);
  };

  for (const kind of reservedKinds) {
    const hit = hits.find((h) => h.doc.kind === kind);
    if (hit) take(hit);
  }

  for (const hit of hits) {
    take(hit);
  }

  return chosen;
}

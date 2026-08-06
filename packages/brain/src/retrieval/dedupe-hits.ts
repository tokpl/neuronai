/**
 * Collapse duplicate location hits that represent the same symbol/file.
 * Keeps the highest-scoring representation.
 */
import type { RetrievalHit } from './rank.js';

export function dedupeRetrievalHits(hits: RetrievalHit[]): RetrievalHit[] {
  const best = new Map<string, RetrievalHit>();
  const order: string[] = [];

  for (const hit of hits) {
    const key = hitKey(hit);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, hit);
      order.push(key);
      continue;
    }
    if (hit.score > existing.score) {
      best.set(key, hit);
    }
  }

  return order.map((k) => best.get(k)!);
}

function hitKey(hit: RetrievalHit): string {
  const loc = hit.doc.location;
  if (!loc) return `id:${hit.doc.id}`;
  const path = loc.path.replace(/\\/g, '/').toLowerCase();
  const name = loc.name.toLowerCase();
  // Prefer collapsing symbol+file for the same path+name.
  return `${path}::${name}`;
}

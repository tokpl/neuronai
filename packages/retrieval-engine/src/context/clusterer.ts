import type { RankedHit } from '../types.js';

export interface MemoryCluster {
  name: string;
  items: RankedHit[];
}

const CLUSTER_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Authentication', pattern: /auth|jwt|rbac|permission|session|login/i },
  { name: 'Database', pattern: /postgres|mysql|sql|migration|schema|database/i },
  { name: 'Payments', pattern: /payment|refund|stripe|billing|invoice|checkout/i },
  { name: 'Frontend', pattern: /react|component|ui|css|zustand|redux|frontend/i },
  { name: 'Architecture', pattern: /architect|module|service|pattern|graph|outbox/i },
];

export class MemoryClusterer {
  cluster(hits: RankedHit[]): MemoryCluster[] {
    const buckets = new Map<string, RankedHit[]>();
    for (const name of CLUSTER_RULES.map((r) => r.name)) buckets.set(name, []);
    buckets.set('Other', []);

    for (const h of hits) {
      const hay = `${h.title} ${h.content}`;
      const match = CLUSTER_RULES.find((r) => r.pattern.test(hay));
      const key = match?.name ?? 'Other';
      buckets.get(key)!.push(h);
    }

    return [...buckets.entries()]
      .filter(([, items]) => items.length > 0)
      .map(([name, items]) => ({ name, items }));
  }
}

export function createMemoryClusterer(): MemoryClusterer {
  return new MemoryClusterer();
}

import type { AssembledContext } from '../types.js';

interface CacheEntry {
  key: string;
  value: AssembledContext;
  at: number;
}

/**
 * Cache common retrieval assemblies; invalidate on memory/constitution version bump.
 */
export class RetrievalCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs = 60_000) {}

  get(key: string): AssembledContext | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() - e.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: AssembledContext): void {
    this.map.set(key, { key, value, at: Date.now() });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.map.clear();
      return;
    }
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }

  static cacheKey(task: string, version: string): string {
    return `${version}::${task.trim().toLowerCase()}`;
  }
}

export function createRetrievalCache(ttlMs?: number): RetrievalCache {
  return new RetrievalCache(ttlMs);
}

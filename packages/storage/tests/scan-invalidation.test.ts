import { describe, expect, it } from 'vitest';

import {
  evidencePathsFor,
  isScanMemoryStale,
  listStaleScanMemories,
  buildLivePathIndex,
} from '../src/scan-invalidation.js';
import type { MemoryRecord } from '@neuronai/types';

function mem(partial: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'title' | 'content'>): MemoryRecord {
  return {
    projectId: 'p',
    type: 'knowledge',
    importanceScore: 0.5,
    confidenceScore: 0.8,
    freshnessScore: 1,
    source: 'git',
    status: 'active',
    version: 1,
    tags: ['scan', 'structure'],
    usageCount: 0,
    lastUsedAt: null,
    embeddingId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('scan memory invalidation', () => {
  it('archives scan memories whose only evidence paths disappeared', () => {
    const stale = mem({
      id: '1',
      title: 'billing module',
      content: 'The billing module lives under paths such as src/billing/service.ts.',
      paths: ['src/billing/service.ts', 'src/billing/routes.ts'],
    });
    const live = buildLivePathIndex([
      'src/payments-domain/service.ts',
      'src/payments-domain/routes.ts',
    ]);
    expect(isScanMemoryStale(stale, live)).toBe(true);
  });

  it('keeps scan memories when evidence still exists', () => {
    const ok = mem({
      id: '2',
      title: 'payments-domain module',
      content: 'The payments-domain module lives under src/payments-domain/service.ts.',
      paths: ['src/payments-domain/service.ts'],
    });
    const live = buildLivePathIndex(['src/payments-domain/service.ts']);
    expect(isScanMemoryStale(ok, live)).toBe(false);
  });

  it('never invalidates user-authored memories', () => {
    const user = mem({
      id: '3',
      title: 'Never call Stripe from routes',
      content: 'Never call Stripe from routes in src/billing/routes.ts',
      source: 'user',
      tags: ['manual'],
      paths: ['src/billing/routes.ts'],
    });
    const live = buildLivePathIndex(['src/payments-domain/routes.ts']);
    expect(isScanMemoryStale(user, live)).toBe(false);
  });

  it('recovers legacy path mentions from prose when paths[] is missing', () => {
    const legacy = mem({
      id: '4',
      title: 'billing module',
      content: 'The billing module lives under paths such as src/billing/service.ts.',
    });
    expect(evidencePathsFor(legacy)).toContain('src/billing/service.ts');
    const removed = listStaleScanMemories([legacy], ['src/payments-domain/service.ts']);
    // Legacy single-path prose is not force-archived (too easy to false-positive).
    expect(removed.map((m) => m.id)).toEqual([]);

    const legacyMulti = mem({
      id: '5',
      title: 'billing module',
      content:
        'The billing module lives under paths such as src/billing/service.ts, src/billing/routes.ts.',
    });
    expect(
      listStaleScanMemories([legacyMulti], ['src/payments-domain/service.ts']).map((m) => m.id),
    ).toEqual(['5']);
  });
});

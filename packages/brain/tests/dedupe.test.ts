import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { MemoryRecord } from '@neuronai/types';

import {
  contentFingerprint,
  dedupeRecords,
  findDuplicate,
  openProjectBrain,
  similarity,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

function decision(id: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString();
  return {
    id,
    projectId: 'p1',
    type: 'architecture_decision',
    title: 'Use RBAC',
    content: 'Problem: need scalable permissions. Decision: use RBAC with hierarchy.',
    status: 'active',
    importanceScore: 0.8,
    confidenceScore: 0.8,
    freshnessScore: 1,
    source: 'manual',
    tags: [],
    version: 1,
    usageCount: 0,
    lastUsedAt: null,
    embeddingId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as MemoryRecord;
}

describe('content deduplication', () => {
  it('treats formatting differences as the same knowledge', () => {
    const a = { type: 'decision', title: 'Use RBAC', content: 'Use RBAC with hierarchy.' };
    const b = { type: 'decision', title: 'use  rbac', content: 'Use RBAC, with hierarchy!' };
    expect(contentFingerprint(a)).toBe(contentFingerprint(b));
  });

  it('does not treat different knowledge as duplicate', () => {
    const a = { title: 'Use RBAC for permissions', content: 'Role based access control.' };
    const b = { title: 'Use Redis for caching', content: 'Cache hot reads in Redis.' };
    expect(similarity(a, b)).toBeLessThan(0.5);
    expect(
      findDuplicate({ type: 'decision', ...b }, [{ id: 'a', type: 'decision', ...a }]),
    ).toBeNull();
  });

  it('detects the same decision re-saved with a reworded body', () => {
    const existing = [
      {
        id: 'a',
        type: 'decision',
        title: 'Use RBAC with hierarchy',
        content: 'We use role based access control with a role hierarchy for permissions.',
      },
    ];
    const match = findDuplicate(
      {
        type: 'decision',
        title: 'Use RBAC with hierarchy',
        content: 'Decision: RBAC, with a hierarchy.',
      },
      existing,
    );
    expect(match?.reason).toBe('near-identical');
    expect(match?.existing.id).toBe('a');
  });

  it('detects near-identical wording under different titles', () => {
    const existing = [
      {
        id: 'a',
        type: 'decision',
        title: 'Role based access control',
        content: 'We use role based access control with a role hierarchy for permissions today.',
      },
    ];
    const match = findDuplicate(
      {
        type: 'decision',
        title: 'RBAC hierarchy',
        content: 'We use role based access control with a role hierarchy for permissions today.',
      },
      existing,
    );
    expect(match?.reason).toBe('near-identical');
  });

  it('only compares records of the same type', () => {
    const existing = [{ id: 'a', type: 'pattern', title: 'Use RBAC', content: 'Use RBAC.' }];
    expect(
      findDuplicate({ type: 'decision', title: 'Use RBAC', content: 'Use RBAC.' }, existing),
    ).toBeNull();
  });

  it('collapses an accumulated pile of duplicates without losing content', () => {
    // Mirrors the real brain that had 47 copies of one decision, one of them empty.
    const records = [
      ...Array.from({ length: 46 }, (_, i) => decision(`d${i}`)),
      decision('d46', { content: 'x' }),
      decision('other', { title: 'Use Redis', content: 'Cache hot reads in Redis for speed.' }),
    ];

    const result = dedupeRecords(records);

    // 47 RBAC copies collapse into one; the unrelated Redis decision survives.
    expect(result.records).toHaveLength(2);
    expect(result.removed).toBe(46);
    expect(result.merges[0]?.mergedIds).toHaveLength(46);
    // The richest content survives — the "x" record does not overwrite it.
    const rbac = result.records.find((r) => r.title === 'Use RBAC');
    expect(rbac?.content).toContain('scalable permissions');
  });

  it('keeps the strongest scores and the union of tags when merging', () => {
    const result = dedupeRecords([
      decision('a', { tags: ['auth'], importanceScore: 0.4, confidenceScore: 0.5 }),
      decision('b', { tags: ['security'], importanceScore: 0.9, confidenceScore: 0.6 }),
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.tags).toEqual(expect.arrayContaining(['auth', 'security']));
    expect(result.records[0]?.importanceScore).toBe(0.9);
    expect(result.records[0]?.confidenceScore).toBe(0.6);
  });

  it('does not create a duplicate decision when the brain already knows it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-dedupe-'));
    temps.push(root);
    const brain = await openProjectBrain(root, { seed: { projectId: 'p1', name: 'demo' } });

    await brain.recordDecision(decision('d1'));
    await brain.recordDecision(decision('d2'));
    await brain.recordDecision(decision('d3', { content: 'Decision: use RBAC with hierarchy.' }));

    expect(brain.knowledge.decisions).toHaveLength(1);
  });

  it('still stores genuinely different decisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-dedupe-distinct-'));
    temps.push(root);
    const brain = await openProjectBrain(root, { seed: { projectId: 'p1', name: 'demo' } });

    await brain.recordDecision(decision('d1'));
    await brain.recordDecision(
      decision('d2', {
        title: 'Use Redis for caching',
        content: 'Cache hot reads in Redis to reduce database pressure.',
      }),
    );

    expect(brain.knowledge.decisions).toHaveLength(2);
  });

  it('reports how many duplicates learn() collapsed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-dedupe-learn-'));
    temps.push(root);
    const brain = await openProjectBrain(root, { seed: { projectId: 'p1', name: 'demo' } });

    const outcome = await brain.learn([decision('a'), decision('b'), decision('c')]);

    expect(outcome.duplicatesRemoved).toBe(2);
    expect(brain.knowledge.decisions).toHaveLength(1);
  });
});

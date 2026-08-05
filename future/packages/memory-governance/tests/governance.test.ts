import { describe, expect, it } from 'vitest';

import type { MemoryRecord } from '@neuron-ai-memory/types';

import {
  createCleanupEngine,
  createConflictResolver,
  createDuplicateMemoryDetector,
  createMemoryArchive,
  createMemoryConflictDetector,
  createMemoryDecayEngine,
  createMemoryGovernanceEngine,
  createMemoryHealthScorer,
  createMemorySimilarityEngine,
  createMemoryValidator,
  createStaleMemoryDetector,
  LIFECYCLE_FLOW,
} from '../src/index.js';

function mem(
  partial: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'title' | 'content' | 'type'>,
): MemoryRecord {
  return {
    projectId: 'p',
    importanceScore: 0.7,
    confidenceScore: 0.8,
    freshnessScore: 0.8,
    source: 'manual',
    status: 'active',
    version: 1,
    tags: [],
    usageCount: 2,
    lastUsedAt: '2026-07-01T00:00:00.000Z',
    embeddingId: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('health scoring', () => {
  it('scores healthy recent memories higher', () => {
    const scorer = createMemoryHealthScorer();
    const healthy = scorer.score(
      mem({
        id: '1',
        type: 'pattern',
        title: 'Service modules',
        content: 'Prefer PaymentService',
        usageCount: 20,
        lastUsedAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        freshnessScore: 0.95,
        confidenceScore: 0.9,
      }),
      { now: new Date('2026-08-05T00:00:00.000Z') },
    );
    const stale = scorer.score(
      mem({
        id: '2',
        type: 'architecture_decision',
        title: 'Old note',
        content: 'maybe',
        usageCount: 0,
        lastUsedAt: null,
        updatedAt: '2024-01-01T00:00:00.000Z',
        freshnessScore: 0.2,
        confidenceScore: 0.4,
      }),
      { now: new Date('2026-08-05T00:00:00.000Z'), staleBoost: 0.3 },
    );

    expect(healthy.healthScore).toBeGreaterThan(stale.healthScore);
    expect(healthy.whyImportant).toMatch(/Why important/);
    expect(stale.whyReviewOrRemove).toMatch(/Why review/);
    expect(LIFECYCLE_FLOW).toContain(healthy.lifecycle);
  });
});

describe('stale detection', () => {
  it('flags Redux memory when code has no Redux', () => {
    const detector = createStaleMemoryDetector();
    const signals = detector.detect(
      [
        mem({
          id: 'redux',
          type: 'dependency',
          title: 'Project uses Redux',
          content: 'State management is Redux',
          usageCount: 0,
          lastUsedAt: null,
          updatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
      {
        codeSignals: ['useStore.ts', 'zustand', 'PaymentService.ts'],
        now: new Date('2026-08-05T00:00:00.000Z'),
      },
    );
    expect(signals.some((s) => s.memoryId === 'redux')).toBe(true);
    expect(signals[0]!.evidence.join(' ')).toMatch(/Redux/i);
  });
});

describe('conflict resolution', () => {
  it('proposes supersede for REST vs GraphQL', () => {
    const resolver = createConflictResolver();
    const suggestions = resolver.resolve([
      mem({
        id: 'a',
        type: 'architecture_decision',
        title: 'Use REST',
        content: 'Decision: Use REST for public API',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      mem({
        id: 'b',
        type: 'architecture_decision',
        title: 'Moved to GraphQL',
        content: 'Decision: Moved to GraphQL',
        updatedAt: '2026-05-01T00:00:00.000Z',
      }),
    ]);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.resolution).toMatch(/superseded/i);
    expect(suggestions[0]!.olderId).toBe('a');
    expect(suggestions[0]!.requiresApproval).toBe(true);
  });
});

describe('duplicate detection', () => {
  it('suggests merge for auth phrasing variants', () => {
    const detector = createDuplicateMemoryDetector();
    const dups = detector.detect([
      mem({
        id: '1',
        type: 'business_rule',
        title: 'All APIs require authentication',
        content: 'Every API requires authentication middleware',
      }),
      mem({
        id: '2',
        type: 'business_rule',
        title: 'Every endpoint uses auth middleware',
        content: 'All endpoints require authentication',
      }),
    ]);
    expect(dups.length).toBeGreaterThan(0);
    expect(dups[0]!.suggestedAction).toBe('merge');
    expect(dups[0]!.requiresApproval).toBe(true);
  });
});

describe('governance scan', () => {
  it('builds brain health report with queue and cleanup suggestions', () => {
    const engine = createMemoryGovernanceEngine();
    const report = engine.scan({
      memories: [
        mem({
          id: 'a',
          type: 'architecture_decision',
          title: 'Use REST',
          content: 'Decision: Use REST',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
        mem({
          id: 'b',
          type: 'architecture_decision',
          title: 'Moved to GraphQL',
          content: 'Decision: Moved to GraphQL',
          updatedAt: '2026-05-01T00:00:00.000Z',
        }),
        mem({
          id: 'c',
          type: 'dependency',
          title: 'Project uses Redux',
          content: 'Redux store',
          usageCount: 0,
          lastUsedAt: null,
        }),
      ],
      codeSignals: ['zustand', 'graphql'],
      now: new Date('2026-08-05T00:00:00.000Z'),
    });

    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.problems.conflicts).toBeGreaterThan(0);
    expect(report.reviewQueue.length).toBeGreaterThan(0);
    expect(report.cleanupSuggestions.every((s) => s.requiresApproval)).toBe(true);
    expect(report.markdown).toMatch(/Project Memory Health/);
    expect(report.totals.conflicts).toBeGreaterThan(0);
    expect(report.decayAdjustments.length).toBeGreaterThan(0);
    expect(engine.maintenancePlan('weekly').enabled).toBe(false);
  });
});

describe('decay', () => {
  it('lowers confidence with age but never deletes', () => {
    const decay = createMemoryDecayEngine();
    const adj = decay.adjust(
      mem({
        id: 'db',
        type: 'architecture_decision',
        title: 'Use PostgreSQL',
        content: 'Primary DB is PostgreSQL',
        importanceScore: 0.98,
        confidenceScore: 0.95,
        usageCount: 234,
        updatedAt: '2024-01-01T00:00:00.000Z',
        lastUsedAt: '2024-02-01T00:00:00.000Z',
      }),
      { now: new Date('2026-08-05T00:00:00.000Z') },
    );
    expect(adj.destructive).toBe(false);
    expect(adj.nextConfidence).toBeLessThanOrEqual(adj.previousConfidence);
    expect(adj.nextImportance).toBeGreaterThan(0.5);
  });
});

describe('validation + archive + cleanup', () => {
  it('validates payment memory via code signals', () => {
    const validator = createMemoryValidator();
    const result = validator.validate(
      mem({
        id: 'pay',
        type: 'dependency',
        title: 'Payment uses Stripe',
        content: 'Stripe handles card payments',
      }),
      { codeSignals: ['stripe-client.ts', 'PaymentService.ts'] },
    );
    expect(result.valid).toBe(true);
    expect(result.sources).toContain('code');

    const archive = createMemoryArchive();
    const proposal = archive.propose(
      mem({
        id: 'old',
        type: 'architecture_decision',
        title: 'Old architecture',
        content: 'Monolith only',
      }),
      'superseded by modular monolith',
    );
    expect(proposal.toLifecycle).toBe('ARCHIVED');
    expect(proposal.requiresApproval).toBe(true);

    const sim = createMemorySimilarityEngine();
    const merge = sim.detect([
      mem({
        id: '1',
        type: 'pattern',
        title: 'Use Redis cache',
        content: 'Redis is used for caching',
      }),
      mem({
        id: '2',
        type: 'pattern',
        title: 'Redis is used for caching',
        content: 'Use Redis cache layer',
      }),
    ]);
    expect(merge.length).toBeGreaterThan(0);

    const cleanup = createCleanupEngine();
    const ops = cleanup.planMerge(merge);
    expect(ops[0]!.permanentDelete).toBe(false);
    expect(ops[0]!.action).toBe('merge');
  });
});

describe('conflict detector alias', () => {
  it('detects REST vs GraphQL via MemoryConflictDetector', () => {
    const detector = createMemoryConflictDetector();
    const conflicts = detector.detect([
      mem({
        id: 'a',
        type: 'architecture_decision',
        title: 'Use REST API',
        content: 'Decision: Use REST',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      mem({
        id: 'b',
        type: 'architecture_decision',
        title: 'Use GraphQL',
        content: 'Decision: Use GraphQL',
        updatedAt: '2026-05-01T00:00:00.000Z',
      }),
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]!.requiresApproval).toBe(true);
  });
});

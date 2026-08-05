import { describe, expect, it } from 'vitest';

import {
  createQueryAnalyzer,
  createRetrievalEngine,
  createContextBudgetManager,
  createConflictAwareFilter,
  createMemoryClusterer,
} from '../src/index.js';
import type { MemoryRecord } from '@neuron-ai-memory/types';

function mem(partial: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'title' | 'content' | 'type'>): MemoryRecord {
  return {
    projectId: 'p',
    importanceScore: 0.8,
    confidenceScore: 0.8,
    freshnessScore: 0.9,
    source: 'manual',
    status: 'active',
    version: 1,
    tags: [],
    usageCount: 0,
    lastUsedAt: null,
    embeddingId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...partial,
  };
}

describe('query understanding', () => {
  it('analyzes payment refunds feature', () => {
    const q = createQueryAnalyzer().analyze('Add payment refunds');
    expect(q.intent).toBe('FEATURE');
    expect(q.domains).toEqual(expect.arrayContaining(['payments']));
    expect(q.related).toEqual(expect.arrayContaining(['transactions', 'database']));
    expect(q.risk).toBe('HIGH');
  });
});

describe('retrieval pipeline', () => {
  it('assembles optimized agent context', async () => {
    const engine = createRetrievalEngine();
    const result = await engine.retrieve({
      task: 'Add payment refunds',
      memories: [
        mem({
          id: '1',
          type: 'architecture_decision',
          title: 'Payments use event-driven flow',
          content: 'Decision: Use outbox for payments. Do not write ledger from HTTP.',
        }),
        mem({
          id: '2',
          type: 'mistake',
          title: 'Do not access database directly',
          content: 'Controllers must use packages/db',
        }),
        mem({
          id: '3',
          type: 'pattern',
          title: 'Service modules',
          content: 'Project prefers PaymentService style modules',
        }),
        mem({
          id: '4',
          type: 'architecture_decision',
          title: 'Use REST',
          content: 'Decision: Use REST for public API',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
        mem({
          id: '5',
          type: 'architecture_decision',
          title: 'Migrate to GraphQL',
          content: 'Decision: Migrate to GraphQL for complex relationships',
          updatedAt: '2026-05-01T00:00:00.000Z',
        }),
      ],
      constitutionRules: ['No direct database access from controllers'],
      fileNames: ['PaymentService.ts', 'RefundService.ts', 'orders.controller.ts'],
      graphModules: ['payments', 'transactions'],
      agentMode: 'standard',
    });

    expect(result.query.intent).toBe('FEATURE');
    expect(result.context.markdown).toMatch(/Agent Context/);
    expect(result.context.tokenEstimate).toBeLessThanOrEqual(result.budget.maxTokens);
    expect(result.context.explanation.length).toBeGreaterThan(0);
    expect(result.metrics.precision).toBeGreaterThan(0);
  });

  it('detects REST vs GraphQL conflict', () => {
    const filter = createConflictAwareFilter();
    const { conflicts, filtered } = filter.detect([
      {
        id: 'a',
        source: 'decision',
        title: 'Use REST',
        content: 'Decision: Use REST',
        updatedAt: '2024-01-01T00:00:00.000Z',
        relevanceScore: 0.5,
        importanceScore: 0.5,
        confidenceScore: 0.5,
        distanceScore: 0.5,
        freshnessScore: 0.2,
        finalScore: 0.4,
      },
      {
        id: 'b',
        source: 'decision',
        title: 'Migrate to GraphQL',
        content: 'Decision: Migrate to GraphQL',
        updatedAt: '2026-05-01T00:00:00.000Z',
        relevanceScore: 0.6,
        importanceScore: 0.6,
        confidenceScore: 0.6,
        distanceScore: 0.5,
        freshnessScore: 0.9,
        finalScore: 0.7,
      },
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(filtered.some((h) => h.id === 'a')).toBe(false);
    expect(filtered.some((h) => h.id === 'b')).toBe(true);
  });
});

describe('token budgets', () => {
  it('maps complexity to token caps', () => {
    const mgr = createContextBudgetManager();
    expect(mgr.plan('small').maxTokens).toBe(1500);
    expect(mgr.plan('standard').maxTokens).toBe(5000);
    expect(mgr.plan('architecture').maxTokens).toBe(15000);
  });
});

describe('clustering', () => {
  it('groups payment hits', () => {
    const clusters = createMemoryClusterer().cluster([
      {
        id: '1',
        source: 'memory',
        title: 'Refund flow',
        content: 'payment refund stripe',
        relevanceScore: 1,
        importanceScore: 1,
        confidenceScore: 1,
        distanceScore: 1,
        freshnessScore: 1,
        finalScore: 1,
      },
    ]);
    expect(clusters.some((c) => c.name === 'Payments')).toBe(true);
  });
});

describe('benchmarks smoke', () => {
  it('handles 100, 10000, and 100000 synthetic memories under soft budgets', async () => {
    const engine = createRetrievalEngine();

    async function run(n: number) {
      const memories = Array.from({ length: n }, (_, i) =>
        mem({
          id: String(i),
          type: i % 7 === 0 ? 'architecture_decision' : 'knowledge',
          title: i % 5 === 0 ? `Payment module ${i}` : `Note ${i}`,
          content: i % 5 === 0 ? 'payments transactions refund outbox' : `generic fact ${i}`,
          importanceScore: (i % 10) / 10,
        }),
      );
      const start = performance.now();
      const result = await engine.retrieve({
        task: 'Add payment refunds',
        memories,
        agentMode: 'standard',
      });
      const ms = performance.now() - start;
      return { ms, tokens: result.context.tokenEstimate, budget: result.budget.maxTokens };
    }

    const small = await run(100);
    expect(small.tokens).toBeLessThanOrEqual(small.budget);
    expect(small.ms).toBeLessThan(5_000);

    const mid = await run(10_000);
    expect(mid.tokens).toBeLessThanOrEqual(mid.budget);
    expect(mid.ms).toBeLessThan(30_000);

    const large = await run(100_000);
    expect(large.tokens).toBeLessThanOrEqual(large.budget);
    expect(large.ms).toBeLessThan(120_000);
  }, 180_000);
});

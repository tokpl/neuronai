import { describe, expect, it } from 'vitest';

import {
  ContextRanker,
  TaskAnalyzer,
  createAgentIntelligence,
  createImplementationPlanner,
  createArchitectureReviewer,
  createChangeRiskAnalyzer,
} from '../src/index.js';
import { createInMemoryMemoryEngine } from '@neuronai/memory-engine';

describe('TaskAnalyzer', () => {
  it('detects feature areas for vehicle trading', () => {
    const task = new TaskAnalyzer().analyze('Add vehicle trading system');
    expect(task.type).toBe('FEATURE');
    expect(task.affectedAreas).toEqual(
      expect.arrayContaining(['vehicles', 'economy', 'database', 'permissions']),
    );
    expect(task.keywords).toEqual(expect.arrayContaining(['vehicle', 'trading']));
  });
});

describe('ContextRanker', () => {
  it('ranks JWT decision above unrelated UI experiment', () => {
    const task = new TaskAnalyzer().analyze('Extend authentication middleware');
    const ranked = new ContextRanker().rank(
      task,
      [
        {
          memory: {
            id: 'a',
            projectId: 'p',
            type: 'architecture_decision',
            title: 'Auth uses JWT',
            content: 'Authentication uses JWT tokens with RBAC permissions',
            importanceScore: 0.95,
            confidenceScore: 0.9,
            freshnessScore: 1,
            source: 'manual',
            status: 'active',
            version: 1,
            tags: ['auth'],
            usageCount: 0,
            lastUsedAt: null,
            embeddingId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          graphDistance: 0,
        },
        {
          memory: {
            id: 'b',
            projectId: 'p',
            type: 'knowledge',
            title: 'Old login UI experiment',
            content: 'Tried a purple login button in 2021',
            importanceScore: 0.2,
            confidenceScore: 0.4,
            freshnessScore: 0.2,
            source: 'manual',
            status: 'active',
            version: 1,
            tags: ['ui'],
            usageCount: 0,
            lastUsedAt: null,
            embeddingId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          graphDistance: 3,
        },
      ],
      5,
    );
    expect(ranked[0]!.title).toMatch(/JWT/i);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});

describe('ImplementationPlanner + Risk + Review', () => {
  it('plans marketplace steps', () => {
    const task = new TaskAnalyzer().analyze('Add marketplace');
    const plan = createImplementationPlanner().plan(task);
    expect(plan.steps.length).toBeGreaterThan(3);
    expect(plan.steps.some((s) => /database|table/i.test(s.title))).toBe(true);
  });

  it('flags schema changes as high risk', async () => {
    const risk = await createChangeRiskAnalyzer().analyze(
      'p1',
      'Migrate database schema for payments and users',
    );
    expect(['HIGH', 'CRITICAL']).toContain(risk.level);
    expect(risk.affects.length).toBeGreaterThan(0);
  });

  it('reviews architecture with score', async () => {
    const review = await createArchitectureReviewer().review({
      projectId: 'p1',
      changeDescription: 'Add feature flag without touching auth middleware',
    });
    expect(review.score).toBeGreaterThan(50);
    expect(review.recommendations.length).toBeGreaterThan(0);
  });
});

describe('AgentIntelligence facade', () => {
  it('prepares task briefing', async () => {
    const engine = createInMemoryMemoryEngine();
    await engine.createMemory({
      projectId: 'demo',
      type: 'architecture_decision',
      title: 'Auth uses JWT',
      content: 'JWT + RBAC; do not bypass middleware',
      source: 'manual',
      tags: ['auth'],
      manualImportance: 0.95,
    });
    const intel = createAgentIntelligence({
      projectId: 'demo',
      engine,
      listMemories: async () =>
        (
          await engine.getProjectMemoryContext({
            projectId: 'demo',
            limit: 50,
            maxTokens: 10_000,
          })
        ).memories,
    });
    const report = await intel.prepareTask('Add vehicle trading system', 'standard');
    expect(report.markdown).toMatch(/Relevant Architecture/);
    expect(report.context.briefing.length).toBeGreaterThan(0);
    expect(report.plan?.steps.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import {
  createArchitectModeEngine,
  createAdrGenerator,
  createArchitectureRiskAnalyzer,
  createArchitectureScore,
  createImplementationPlanner,
  createRequirementAnalyzer,
  createSolutionDesigner,
} from '../src/index.js';

describe('requirement + planning', () => {
  it('analyzes payment system request', () => {
    const req = createRequirementAnalyzer().analyze('Dodaj system płatności.');
    expect(req.feature).toMatch(/Payment/i);
    expect(req.affected).toEqual(
      expect.arrayContaining(['Users', 'Transactions', 'Database', 'Notifications']),
    );
    expect(req.complexity).toBe('HIGH');
    expect(req.risk).toBe('HIGH');

    const plan = createImplementationPlanner().plan(req);
    expect(plan.steps.map((s) => s.title)).toEqual(
      expect.arrayContaining([
        'Database changes',
        'Backend services',
        'API endpoints',
        'Frontend integration',
        'Tests',
        'Documentation',
      ]),
    );
  });
});

describe('risk + ADR', () => {
  it('flags migration risk and pending ADR', () => {
    const req = createRequirementAnalyzer().analyze('Add payment refunds');
    const proposal = createSolutionDesigner().design(req, {
      patterns: ['Prefer service modules'],
      mistakes: ['Do not bypass packages/db'],
    });
    const risk = createArchitectureRiskAnalyzer().analyze(req, {
      mistakes: ['Do not bypass packages/db'],
    });
    expect(risk.level).toBe('HIGH');
    expect(risk.reasons.some((r) => /migration|users|Money|authz/i.test(r))).toBe(true);

    const adr = createAdrGenerator().generate(req, proposal, risk);
    expect(adr.status).toBe('Pending approval');
  });
});

describe('architecture comparison', () => {
  it('scores before/after', () => {
    const score = createArchitectureScore().compare({
      before: 72,
      betterSeparation: true,
    });
    expect(score.before).toBe(72);
    expect(score.after).toBeGreaterThan(score.before);
    expect(score.reason).toMatch(/separation|compliance/i);
  });
});

describe('architect facade', () => {
  it('returns full architecture proposal markdown', () => {
    const engine = createArchitectModeEngine();
    const report = engine.run({
      request: 'Create marketplace system',
      mode: 'ARCHITECT',
      memory: {
        decisions: ['Payments use event sourcing'],
        patterns: ['Service modules'],
        constitution: ['No direct DB from controllers'],
        modules: ['payments', 'users'],
        graphEdges: [
          { from: 'Users', to: 'Authentication' },
          { from: 'Users', to: 'Billing' },
        ],
      },
    });
    expect(report.markdown).toMatch(/# Architecture Proposal/);
    expect(report.markdown).toMatch(/## Implementation Plan/);
    expect(report.adr.status).toBe('Pending approval');
    expect(engine.isMajorFeature('Create marketplace system')).toBe(true);
    expect(engine.isMajorFeature('fix typo in README')).toBe(false);
  });

  it('reviews changes vs plan', () => {
    const engine = createArchitectModeEngine();
    const plan = engine.createPlan('Add payment refunds');
    const review = engine.reviewChange({
      request: 'Add payment refunds',
      priorPlan: plan,
      changedPaths: ['src/payments/RefundService.ts', 'src/controllers/PayController.ts'],
      changeSummary: 'Added refunds; controller calls prisma',
      memory: { mistakes: ['Do not access database directly'] },
    });
    expect(review.review?.brokenPatterns.length).toBeGreaterThan(0);
  });
});

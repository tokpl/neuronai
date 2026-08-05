import { describe, expect, it } from 'vitest';

import {
  createArchitectureReviewEngine,
  createArchitectureRuleEngine,
  createComplexityAnalyzer,
  createDependencyAnalyzer,
  createArchitectureHealthScorer,
} from '../src/index.js';

describe('dependency tests', () => {
  it('detects A→B→A circular dependency', () => {
    const result = createDependencyAnalyzer().analyze(
      [
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
      ],
      [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ],
    );
    expect(result.circular.length).toBeGreaterThan(0);
    expect(result.circular[0]!.warning).toMatch(/Circular dependency/i);
  });
});

describe('rule tests', () => {
  it('flags core depending on application', () => {
    const violations = createArchitectureRuleEngine().evaluate({
      modules: [
        { id: 'core', name: 'Core', layer: 'core' },
        { id: 'app', name: 'App', layer: 'application' },
      ],
      edges: [{ from: 'core', to: 'app' }],
    });
    expect(violations.some((v) => v.ruleId === 'core-no-app-deps')).toBe(true);
  });

  it('flags storage abstraction leaks', () => {
    const violations = createArchitectureRuleEngine().evaluate({
      modules: [
        {
          id: 'svc',
          name: 'BillingService',
          layer: 'application',
          responsibilities: ['raw sql queries'],
        },
      ],
      edges: [],
    });
    expect(violations.some((v) => v.ruleId === 'storage-abstraction')).toBe(true);
  });
});

describe('complexity tests', () => {
  it('flags large files and deep nesting', () => {
    const nested = '{'.repeat(6) + 'x' + '}'.repeat(6);
    const findings = createComplexityAnalyzer().analyze([
      { location: 'big.ts', loc: 500 },
      { location: 'deep.ts', source: nested },
    ]);
    expect(findings.some((f) => f.kind === 'large_file')).toBe(true);
    expect(findings.some((f) => f.kind === 'deep_nesting')).toBe(true);
  });
});

describe('score tests', () => {
  it('returns Architecture Health style score', () => {
    const score = createArchitectureHealthScorer().score({
      coupling: [{ moduleId: 'a', fanIn: 1, fanOut: 1, highCoupling: false }],
      complexity: [],
      ruleViolations: [],
      circularCount: 0,
      testCoverage: 80,
      documentation: 85,
      security: 90,
    });
    expect(score.score).toBeGreaterThanOrEqual(80);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it('full scan produces plans and report for circular deps', () => {
    const eng = createArchitectureReviewEngine();
    const result = eng.scan({
      modules: [
        {
          id: 'memory',
          name: 'Memory',
          responsibilities: ['database logic', 'AI provider logic'],
        },
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
      ],
      dependencies: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ],
      label: 'before',
    });
    expect(result.score.score).toBeGreaterThanOrEqual(0);
    expect(result.issues.some((i) => /Circular/i.test(i))).toBe(true);
    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.reportMarkdown).toContain('Architecture Health');
    expect(result.plans[0]!.suggestedSteps.length).toBeGreaterThan(0);
  });
});

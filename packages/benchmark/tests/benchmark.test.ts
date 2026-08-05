import { describe, expect, it } from 'vitest';

import {
  createBenchmarkPlatform,
  createMemoryQualityEvaluator,
  createMetricsCalculator,
  TASK_DATASET,
  BENCHMARK_PROJECTS,
} from '../src/index.js';

describe('benchmark suite', () => {
  it('defines three projects and five task kinds', () => {
    expect(BENCHMARK_PROJECTS.map((p) => p.id)).toEqual(['ecommerce', 'saas', 'game-server']);
    expect(TASK_DATASET.map((t) => t.kind).sort()).toEqual(
      ['ARCHITECTURE', 'BUGFIX', 'DEBUG', 'FEATURE', 'REFACTOR'].sort(),
    );
  });

  it('scores WITH_NEURON better on tokens than raw dump', () => {
    const calc = createMetricsCalculator();
    const task = TASK_DATASET.find((t) => t.id === 'architecture-payment-system')!;
    const without = calc.evaluate({
      mode: 'WITHOUT_NEURON',
      task,
      contextText: 'css rename variable changelog ' + task.expectedFacts.join(' '),
      tokenEstimate: 15_000,
    });
    const withN = calc.evaluate({
      mode: 'WITH_NEURON',
      task,
      contextText: 'payments event sourcing outbox ledger Decision: payments use event sourcing',
      tokenEstimate: 3_500,
    });
    expect(withN.tokenEstimate).toBeLessThan(without.tokenEstimate);
    expect(withN.contextPrecision).toBeGreaterThanOrEqual(without.contextPrecision);
  });

  it('classifies good vs bad memory candidates', () => {
    const ev = createMemoryQualityEvaluator();
    const result = ev.evaluate();
    expect(result.accuracy).toBeGreaterThanOrEqual(0.75);
  });

  it('runs full suite in fast mode and writes report markdown', async () => {
    const platform = createBenchmarkPlatform();
    const result = await platform.run({ fast: true });
    expect(result.markdown).toMatch(/Neuron Evaluation/);
    expect(result.comparison.tokenReductionPct).toBeGreaterThan(0);
    expect(result.retrieval.length).toBe(3);
    expect(result.retrieval.every((r) => r.tokenEstimate <= r.budget)).toBe(true);
    expect(platform.status().ready).toBe(true);
    expect(platform.status().lastRunAt).toBeTruthy();
  }, 60_000);
});

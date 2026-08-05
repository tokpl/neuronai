import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvaluationEngine,
  createHallucinationDetector,
  createNeuronRetrievalEvaluator,
  createQualityMetricsCalculator,
  createNeuronBenchmarkSuite,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const d of temps.splice(0)) {
    await rm(d, { recursive: true, force: true });
  }
});

describe('metrics', () => {
  it('scores accuracy/relevance/completeness', () => {
    const calc = createQualityMetricsCalculator();
    const { metrics } = calc.compute({
      answer: 'Auth uses JWT session tokens and permission checks.',
      expectedKeywords: ['auth', 'jwt', 'permission'],
      unexpectedKeywords: ['css'],
    });
    expect(metrics.accuracy).toBeGreaterThan(0.7);
    expect(metrics.overall).toBeGreaterThan(0.5);
  });
});

describe('retrieval', () => {
  it('marks unrelated frontend memories as LOW for auth query', () => {
    const ev = createNeuronRetrievalEvaluator();
    const result = ev.evaluate({
      query: 'How authentication works?',
      expectedTitles: ['Auth service', 'Session store'],
      retrievedTitles: ['Button styles', 'Homepage layout', 'CSS tokens'],
    });
    expect(result.score).toBe('LOW');
    expect(result.precision).toBeLessThan(0.3);
    expect(result.evidence[0]).toMatch(/expected/i);
  });
});

describe('hallucination', () => {
  it('warns when Redis is claimed but missing from graph', () => {
    const det = createHallucinationDetector();
    const report = det.detect('There is Redis cache in front of Postgres.', {
      knownFacts: ['PostgreSQL', 'Next.js'],
      knownFiles: ['src/db/client.ts'],
      knownDecisions: ['Use PostgreSQL'],
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.claim.includes('Redis'))).toBe(true);
  });
});

describe('benchmark', () => {
  it('runs builtin suite and writes evaluation.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neuron-eval-'));
    temps.push(dir);
    await mkdir(join(dir, 'benchmarks'), { recursive: true });
    await writeFile(
      join(dir, 'benchmarks', 'auth-tests.json'),
      JSON.stringify({
        id: 'auth-custom',
        category: 'architecture',
        question: 'How authentication works?',
        expectedKeywords: ['auth', 'session'],
      }),
      'utf8',
    );

    const suite = createNeuronBenchmarkSuite();
    const run = await suite.run({ neuronDir: dir });
    expect(run.cases.length).toBeGreaterThanOrEqual(5);
    expect(run.overall).toBeGreaterThan(0);

    const eng = createEvaluationEngine();
    await eng.load(dir);
    const result = await eng.runBenchmark(dir);
    expect(result.run.overall).toBeGreaterThan(0);

    const report = eng.qualityReport();
    expect(report.note).toMatch(/Metrics only/);
    expect(report.lastBenchmark).not.toBeNull();
  });

  it('evaluateAnswer + feedback + memory quality', async () => {
    const eng = createEvaluationEngine();
    const evalResult = eng.evaluateAnswer({
      task: 'Explain auth',
      answer: 'Auth uses JWT and permission middleware.',
      expectedKeywords: ['auth', 'jwt', 'permission'],
      hallucinationContext: {
        knownFacts: ['JWT', 'auth'],
        knownFiles: [],
        knownDecisions: [],
      },
    });
    expect(evalResult.score).toBeGreaterThan(0.4);
    eng.recordFeedback({ label: 'Helpful', task: 'Explain auth', evaluationId: evalResult.id });
    const memories = eng.scoreMemories([
      {
        memoryId: 'm1',
        title: 'Use PostgreSQL',
        confidence: 0.98,
        usageFrequency: 234,
        validationCount: 12,
        ageDays: 10,
      },
    ]);
    expect(memories[0]!.confidence).toBeGreaterThan(0.9);
    eng.recordModelScore({
      provider: 'anthropic',
      model: 'claude',
      task: 'ARCHITECTURE_REASONING',
      score: 0.92,
    });
    eng.recordModelScore({
      provider: 'ollama',
      model: 'llama',
      task: 'ARCHITECTURE_REASONING',
      score: 0.84,
    });
    const cmp = eng.modelComparison('ARCHITECTURE_REASONING');
    expect(cmp.rows[0]!.score).toBeGreaterThanOrEqual(cmp.rows[1]!.score);
  });
});

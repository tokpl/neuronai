import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  classifyKnowledge,
  computeBrainMetrics,
  emptyDna,
  emptyHealth,
  emptyKnowledge,
  explainCompressionMetric,
  openProjectBrain,
} from '../src/index.js';
import { buildCompressionMetrics } from '../src/compiler/metrics.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('buildCompressionMetrics', () => {
  it('computes compression metrics correctly', () => {
    const metrics = buildCompressionMetrics({
      mode: 'minimal',
      tokenBudget: 1000,
      candidates: 100,
      relevant: 50,
      selected: 10,
      duplicatesRemoved: 5,
      compiledTokens: 500,
      rawCorpusTokens: 2500,
      retrievalMs: 15,
      compileMs: 25,
    });

    expect(metrics.mode).toBe('minimal');
    expect(metrics.tokenBudget).toBe(1000);
    expect(metrics.candidates).toBe(100);
    expect(metrics.relevant).toBe(50);
    expect(metrics.selected).toBe(10);
    expect(metrics.discarded).toBe(90); // 100 - 10
    expect(metrics.duplicatesRemoved).toBe(5);
    expect(metrics.compiledTokens).toBe(500);
    expect(metrics.rawCorpusTokens).toBe(2500);
    expect(metrics.compressionRatio).toBe(5); // 2500 / 500
    expect(metrics.retrievalMs).toBe(15);
    expect(metrics.compileMs).toBe(25);
    expect(metrics.kindNotes.compressionRatio).toBe('derived');
  });

  it('handles edge cases in compression metrics', () => {
    const metrics = buildCompressionMetrics({
      mode: 'complete',
      tokenBudget: 1000,
      candidates: 5,
      relevant: 5,
      selected: 10, // selected > candidates
      duplicatesRemoved: 0,
      compiledTokens: 0, // 0 tokens, should not divide by zero
      rawCorpusTokens: 1000,
      retrievalMs: 5,
      compileMs: 10,
    });

    expect(metrics.discarded).toBe(0); // Math.max(0, 5 - 10)
    expect(metrics.compressionRatio).toBe(1000); // 1000 / Math.max(1, 0)
  });

  it('explains compression metrics', () => {
    const metrics = buildCompressionMetrics({
      mode: 'minimal',
      tokenBudget: 1000,
      candidates: 100,
      relevant: 50,
      selected: 10,
      duplicatesRemoved: 5,
      compiledTokens: 500,
      rawCorpusTokens: 2500,
      retrievalMs: 15,
      compileMs: 25,
    });

    const explanation = explainCompressionMetric(metrics, 'compressionRatio');
    expect(explanation).toContain('compressionRatio: 5');
    expect(explanation).toContain('Kind: derived');
    expect(explanation).toContain('rawCorpusTokens / compiledTokens (derived)');

    const unknownExplanation = explainCompressionMetric(metrics, 'unknownKey');
    expect(unknownExplanation).toContain('unknownKey: undefined');
    expect(unknownExplanation).toContain('No explanation registered for this key.');
  });
});

describe('Brain learning classify + metrics', () => {
  it('classifies architecture vs technology', () => {
    const arch = classifyKnowledge({
      hasArchitectureHint: true,
      title: 'Refactor auth',
      content: 'All components use ProjectBrain',
    });
    expect(arch.label).toBe('Architecture Decision');

    const tech = classifyKnowledge({
      hasDependencyChange: true,
      title: 'Add redis',
    });
    expect(tech.label).toBe('Technology Decision');
  });

  it('metrics mark estimates clearly and explain health', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-metrics-'));
    temps.push(root);
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'p1', name: 'demo', stack: ['node'] },
    });
    await brain.recordDecision({
      id: 'd1',
      projectId: 'p1',
      type: 'architecture_decision',
      title: 'Use ProjectBrain',
      content: 'Single SoT',
      status: 'active',
      importanceScore: 0.9,
      confidenceScore: 0.95,
      freshnessScore: 1,
      source: 'manual',
      tags: [],
      version: 1,
      usageCount: 0,
      lastUsedAt: null,
      embeddingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const snap = brain.metrics();
    expect(snap.byKey['health']?.kind).toBe('measured');
    expect(snap.byKey['architecture_decisions']?.value).toBe(1);
    expect(snap.byKey['knowledge_confidence']?.kind).toBe('derived');

    const why = brain.explainMetric('health');
    expect(why).toMatch(/Health/);
    expect(why).toMatch(/Kind: measured/);
    expect(why).toMatch(/Sources:/);

    const report = brain.formatMetricsReport();
    expect(report).toMatch(/Project Brain/);
    expect(report).toMatch(/\(derived\)/);
  });

  it('does not invent business-value metrics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-metrics-honest-'));
    temps.push(root);
    const brain = await openProjectBrain(root, { seed: { projectId: 'p1', name: 'demo' } });

    // These were heuristics presented as savings; they must not come back.
    for (const key of [
      'est_tokens_saved',
      'est_time_saved_hours',
      'est_prompt_reduction_pct',
      'est_context_reuse_pct',
    ]) {
      expect(brain.metrics().byKey[key]).toBeUndefined();
    }
  });

  it('reports compression only once a real compilation has run', () => {
    const base = {
      dna: emptyDna({ projectId: 'p1', name: 'demo' }),
      knowledge: emptyKnowledge(),
      health: emptyHealth(),
    };

    expect(computeBrainMetrics(base).byKey['compression_ratio']).toBeUndefined();

    const withSample = computeBrainMetrics({
      ...base,
      lastCompression: {
        mode: 'minimal',
        candidates: 40,
        selected: 5,
        compiledTokens: 420,
        rawCorpusTokens: 4200,
        compressionRatio: 10,
        retrievalMs: 2,
        duplicatesRemoved: 3,
      },
    });

    expect(withSample.byKey['compression_ratio']?.display).toBe('10×');
    expect(withSample.byKey['last_duplicates_removed']?.value).toBe(3);
  });
});

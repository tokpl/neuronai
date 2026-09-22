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
  openProjectBrain,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
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

  it('computes core metrics accurately with a populated input', () => {
    const dna = emptyDna({ projectId: 'p2', name: 'demo-core' });
    dna.meta.overallConfidence = 0.8; // 80% DNA confidence
    dna.structure.modules = { value: ['mod-a', 'mod-b'], confidence: 0.9 }; // 2 modules

    const knowledge = emptyKnowledge();
    knowledge.decisions.push({
      id: 'd1',
      projectId: 'p2',
      type: 'architecture_decision',
      title: 'Decide DB',
      content: 'PostgreSQL',
      status: 'active',
      importanceScore: 0.9,
      confidenceScore: 0.9, // Used for decision confidence calculation
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
    // Add multiple rules and memory entries to increase knowledge entries
    knowledge.rules.push({ id: 'r1', content: 'Rule 1' } as any);
    knowledge.memory.push({ id: 'm1', content: 'Memory 1' } as any);
    knowledge.graph.nodes = [{ id: 'node1' }, { id: 'node2' }, { id: 'node3' }] as any; // 3 nodes
    knowledge.graph.edges = [{ source: 'node1', target: 'node2' }] as any; // 1 relationship

    const health = emptyHealth();
    health.architectureHealthy = true;
    health.knowledgeFresh = true;
    health.score = 85;

    const snapshot = computeBrainMetrics({ dna, knowledge, health });

    expect(snapshot.byKey['modules_understood']?.value).toBe(2);
    expect(snapshot.byKey['files_understood']?.value).toBe(3);
    expect(snapshot.byKey['relationships']?.value).toBe(1);
    expect(snapshot.byKey['knowledge_entries']?.value).toBe(3); // 1 decision + 1 rule + 1 memory
    expect(snapshot.byKey['health']?.value).toBe(85);

    // dnaConfidence: 0.8 * 100 = 80
    expect(snapshot.byKey['dna_confidence']?.value).toBe(80);

    // architectureConfidence: 45% of dnaConfidence (80) + 40% of decisionConfidence (90) + 15 (architectureHealthy)
    // = 36 + 36 + 15 = 87
    expect(snapshot.byKey['architecture_confidence']?.value).toBe(87);

    // knowledgeConfidence: capped at 100
    // knowledgeFresh (25) + min(50, entries*2 = 6) + dnaConfidence*0.25 (20) = 25 + 6 + 20 = 51
    expect(snapshot.byKey['knowledge_confidence']?.value).toBe(51);
  });

  it('handles empty states and undefined graph features gracefully', () => {
    const dna = emptyDna({ projectId: 'p3', name: 'demo-empty' });
    dna.structure.modules = { value: [], confidence: 0 }; // empty modules facet

    const knowledge = emptyKnowledge();
    // Simulate undefined nodes and edges (might happen in a truly empty/fresh initialization)
    knowledge.graph.nodes = undefined as any;
    knowledge.graph.edges = undefined as any;

    const health = emptyHealth();
    // Setting architectureHealthy to false since emptyHealth sets it to true by default,
    // which adds +15 to the architectureConfidence.
    health.architectureHealthy = false;

    const snapshot = computeBrainMetrics({ dna, knowledge, health });

    expect(snapshot.byKey['modules_understood']?.value).toBe(0);
    expect(snapshot.byKey['files_understood']?.value).toBe(0);
    expect(snapshot.byKey['relationships']?.value).toBe(0);
    expect(snapshot.byKey['knowledge_entries']?.value).toBe(0);
    expect(snapshot.byKey['architecture_confidence']?.value).toBe(0);
    expect(snapshot.byKey['knowledge_confidence']?.value).toBe(0);
  });
});

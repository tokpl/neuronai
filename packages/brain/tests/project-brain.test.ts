import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ProjectBrain, openProjectBrain } from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('ProjectBrain', () => {
  it('is explicitly exported as a class', () => {
    expect(ProjectBrain).toBeDefined();
    expect(typeof ProjectBrain).toBe('function');
    expect(typeof ProjectBrain.open).toBe('function');
  });

  it('exposes ProjectBrain class that can be initialized via open()', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-brain-class-'));
    temps.push(root);

    const brain = await ProjectBrain.open(root, {
      seed: { projectId: 'p-class', name: 'class-test', stack: ['typescript'] },
    });

    expect(brain).toBeInstanceOf(ProjectBrain);
    expect(brain.dna.identity.name?.value).toBe('class-test');

    // Test saving and loading
    brain.dna.identity.summary = { value: 'Updated summary' };
    await brain.save();

    const loadedBrain = await ProjectBrain.open(root);
    expect(loadedBrain.dna.identity.summary?.value).toBe('Updated summary');

    // Test update methods
    await loadedBrain.updateDNA({ ...loadedBrain.dna, identity: { ...loadedBrain.dna.identity, name: { value: 'renamed' } } });
    expect(loadedBrain.dna.identity.name?.value).toBe('renamed');

    await loadedBrain.updateKnowledge({ rules: [{ id: 'r1', title: 'test rule', body: 'body', type: 'rule' }] });
    expect(loadedBrain.knowledge.rules).toHaveLength(1);
    expect(loadedBrain.knowledge.rules[0].title).toBe('test rule');
  });

  it('creates brain/ layout and status', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-brain-'));
    temps.push(root);

    const brain = await openProjectBrain(root, {
      seed: { projectId: 'p1', name: 'demo', stack: ['node'] },
    });

    expect(brain.paths.dna.endsWith(join('brain', 'dna.json'))).toBe(true);
    expect(brain.dna.identity.name?.value).toBe('demo');
    expect(brain.knowledge.version).toBe(1);

    const status = brain.status();
    expect(status.dnaUpdated).toBe(true);
    expect(status.healthPercent).toBeGreaterThan(0);

    const raw = JSON.parse(await readFile(brain.paths.dna, 'utf8')) as {
      identity: { name: { value: string } };
    };
    expect(raw.identity.name.value).toBe('demo');
  });

  it('migrates flat legacy files into brain/', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-brain-mig-'));
    temps.push(root);
    const neuron = join(root, '.neuron');
    await mkdir(neuron, { recursive: true });
    await writeFile(
      join(neuron, 'brain.json'),
      JSON.stringify({
        version: 1,
        projectId: 'legacy',
        name: 'Legacy',
        stack: ['next'],
        updatedAt: new Date().toISOString(),
      }),
      'utf8',
    );
    await writeFile(
      join(neuron, 'decisions.json'),
      JSON.stringify({
        version: 1,
        decisions: [
          {
            id: 'd1',
            projectId: 'legacy',
            type: 'architecture_decision',
            title: 'Use App Router',
            content: 'Next.js App Router',
            status: 'active',
            importanceScore: 0.9,
            confidence: 0.9,
            source: 'manual',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      }),
      'utf8',
    );

    const brain = await openProjectBrain(root);
    expect(brain.knowledge.decisions).toHaveLength(1);
    expect(brain.dna.identity.name?.value).toBe('Legacy');
    expect(brain.migrationNotes.some((n) => n.includes('legacy'))).toBe(true);

    await expect(readFile(join(neuron, 'brain.json'), 'utf8')).rejects.toThrow();
  });

  it('learn() folds engine memories into the knowledge plane', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-brain-sync-'));
    temps.push(root);
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'p1', name: 'sync' },
    });

    await brain.learn([
      {
        id: 'm1',
        projectId: 'p1',
        type: 'knowledge',
        title: 'Pattern',
        content: 'Use ProjectBrain',
        status: 'active',
        importanceScore: 0.8,
        confidence: 0.9,
        source: 'manual',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'd1',
        projectId: 'p1',
        type: 'architecture_decision',
        title: 'Brain layout',
        content: 'Use brain/ directory',
        status: 'active',
        importanceScore: 0.9,
        confidence: 0.9,
        source: 'manual',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(brain.knowledge.memory).toHaveLength(1);
    expect(brain.knowledge.decisions).toHaveLength(1);
    expect(brain.status().knowledgeUpdated).toBe(true);
  });

  it('supports auxiliary methods like updateMap, updateCode, metrics, and health', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-brain-aux-'));
    temps.push(root);
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'p2', name: 'aux-test', stack: ['node'] },
    });

    // Code & Map Updates
    await brain.updateMap({
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [
        { kind: 'file', name: 'src/index.ts', path: 'src/index.ts' }
      ]
    });
    expect(brain.getMap().entries[0].name).toBe('src/index.ts');

    await brain.updateCode({
      files: [{ id: 'f1', path: 'src/index.ts', symbols: [] }],
      symbols: [],
      relations: [],
    });
    expect(brain.getCode()?.files).toHaveLength(1);

    // Health
    // Ensure that evolve recalculates health notes from current dna and knowledge
    await brain.evolve();
    expect(brain.health.score).toBeGreaterThanOrEqual(0);

    // Note: updateHealth calls this.save() which recalculates health from dna/knowledge
    // so any overridden properties like notes get overwritten. We can test it by
    // setting something that affects the computed health or mock computeHealth.
    // However, updating dna metadata affects health score:
    await brain.updateDNA({ ...brain.dna, meta: { ...brain.dna.meta, overallConfidence: 0.5 } });
    await brain.evolve();
    expect(brain.health.notes).toContain('DNA present');

    // Metrics
    const metrics = brain.metrics();
    expect(metrics).toBeDefined();
    expect(brain.formatMetricsReport()).toContain('Project Brain');
    expect(brain.explainMetric('dnaCompleteness')).toBeTruthy();

    // Explain & Query
    const explanation = brain.explain();
    expect(explanation).toContain('Project Brain health');

    // Test that the recordDecision method works
    await brain.recordDecision({
        id: 'd10',
        projectId: 'p2',
        type: 'architecture_decision',
        title: 'Use TypeScript',
        content: 'Type safety',
        status: 'active',
        importanceScore: 0.9,
        confidence: 0.9,
        source: 'manual',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    expect(brain.knowledge.decisions).toHaveLength(1);
    expect(brain.knowledge.decisions[0].title).toBe('Use TypeScript');

    // Test seedIdentity
    await brain.seedIdentity({ projectId: 'new-id', name: 'new-name' });
    expect(brain.dna.identity.projectId?.value).toBe('new-id');

    // Test preferences saving
    await brain.savePrefs({ mode: 'test' });
    expect(brain.prefs?.mode).toBe('test');

    // Test getGraph
    const graph = brain.getGraph();
    expect(graph.nodes).toBeDefined();
    expect(graph.edges).toBeDefined();

    await brain.updateGraph({ nodes: [{ id: 'n1', label: 'test' }], edges: [] });
    expect(brain.getGraph().nodes).toHaveLength(1);

    // Test query
    const results = brain.query('TypeScript');
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);

    // Test code queries
    expect(brain.findSymbol('test')).toEqual([]);
    expect(brain.getSymbol('test')).toBeUndefined();
    expect(brain.getDependencies('test')).toEqual([]);
    expect(brain.getDependents('test')).toEqual([]);
    expect(brain.getImpact('test')).toBeUndefined();
    expect(brain.explainCode('test')).toBeUndefined();
    expect(brain.explainFlow('test')).toEqual([]);
  });
});

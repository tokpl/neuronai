import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { openProjectBrain } from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('ProjectBrain', () => {
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
});

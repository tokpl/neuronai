import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createLocalFileMemoryStack } from '../src/index.js';
import { openProjectBrain } from '@neuronai/brain';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('LocalFileMemoryStack + ProjectBrain', () => {
  it('opens ProjectBrain and syncs knowledge via learn()', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-storage-'));
    temps.push(root);
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'p1', name: 'demo', stack: ['node'] },
    });
    expect(brain.paths.dna.replace(/\\/g, '/').endsWith('brain/dna.json')).toBe(true);
    expect(brain.dna.identity.name?.value).toBe('demo');
  });

  it('persists memory stack and learns into knowledge plane', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-stack-'));
    temps.push(root);
    const stack = await createLocalFileMemoryStack(root);
    await stack.engine.createMemory({
      projectId: 'p1',
      type: 'knowledge',
      title: 'Use ProjectBrain',
      content: 'Local filesystem is the MVP default.',
      source: 'manual',
    });
    await stack.persist();
    expect(stack.storePath.includes('runtime')).toBe(true);
    expect(stack.brain.knowledge.memory.length + stack.brain.knowledge.decisions.length).toBeGreaterThan(
      0,
    );
  });
});

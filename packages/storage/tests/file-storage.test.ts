import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createFileStorageProvider, createLocalFileMemoryStack } from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('FileStorageProvider', () => {
  it('creates versioned .neuron layout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-storage-'));
    temps.push(root);
    const storage = createFileStorageProvider();
    await storage.ensureLayout(root);
    const paths = storage.paths(root);
    expect(paths.brain.endsWith('brain.json')).toBe(true);
    expect(paths.store.includes('runtime')).toBe(true);

    await storage.writeBrain(root, {
      version: 1,
      projectId: 'p1',
      name: 'demo',
      stack: ['node'],
      updatedAt: new Date().toISOString(),
    });
    const brain = await storage.readBrain(root);
    expect(brain?.name).toBe('demo');
  });

  it('persists memory stack under runtime/', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-stack-'));
    temps.push(root);
    const stack = await createLocalFileMemoryStack(root);
    await stack.engine.createMemory({
      projectId: 'p1',
      type: 'knowledge',
      title: 'Use FileStorageProvider',
      content: 'Local filesystem is the MVP default.',
      source: 'manual',
    });
    await stack.persist();
    expect(stack.storePath.includes('runtime')).toBe(true);
    const knowledge = await stack.storage.readKnowledge(root);
    expect(knowledge.patterns.length + knowledge.other.length).toBeGreaterThan(0);
  });
});

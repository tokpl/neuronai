import { join, resolve } from 'node:path';

import type { BrainPaths } from './models.js';

/** Durable brain files live in `.neuron/brain/`; everything regenerable lives elsewhere. */
export function resolveBrainPaths(projectRoot: string): BrainPaths {
  const root = resolve(projectRoot);
  const neuronDir = join(root, '.neuron');
  const brainDir = join(neuronDir, 'brain');
  const runtimeDir = join(neuronDir, 'runtime');
  return {
    projectRoot: root,
    neuronDir,
    prefs: join(neuronDir, 'prefs.json'),
    brainDir,
    dna: join(brainDir, 'dna.json'),
    knowledge: join(brainDir, 'knowledge.json'),
    health: join(brainDir, 'health.json'),
    runtimeDir,
    store: join(runtimeDir, 'store.json'),
    cacheDir: join(neuronDir, 'cache'),
  };
}

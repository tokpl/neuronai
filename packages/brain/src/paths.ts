import { join, resolve } from 'node:path';

import type { BrainPaths } from './models.js';

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
    goals: join(brainDir, 'goals.json'),
    active: join(brainDir, 'active.json'),
    evolutionDir: join(neuronDir, 'evolution'),
    runtimeDir,
    store: join(runtimeDir, 'store.json'),
    cacheDir: join(neuronDir, 'cache'),
    logsDir: join(neuronDir, 'logs'),
    indexesDir: join(neuronDir, 'indexes'),
  };
}

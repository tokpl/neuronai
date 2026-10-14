import { join, resolve } from 'node:path';

import type { BrainPaths } from './models.js';

/** Durable brain files live in `.neuron/brain/`; everything regenerable lives elsewhere. */
export function resolveBrainPaths(projectRoot: string): BrainPaths {
  const root = resolve(projectRoot);
  const neuronDir = join(root, '.neuron');
  const brainDir = join(neuronDir, 'brain');
  const runtimeDir = join(neuronDir, 'runtime');
  const workflowDir = join(neuronDir, 'workflow');
  return {
    projectRoot: root,
    neuronDir,
    prefs: join(neuronDir, 'prefs.json'),
    projectMap: join(neuronDir, 'PROJECT_MAP.md'),
    workflowDir,
    workflowBoard: join(workflowDir, 'board.json'),
    workflowGate: join(workflowDir, 'gate.json'),
    workflowHistory: join(workflowDir, 'history.jsonl'),
    memoryDir: join(neuronDir, 'memory'),
    brainDir,
    dna: join(brainDir, 'dna.json'),
    knowledge: join(brainDir, 'knowledge.json'),
    health: join(brainDir, 'health.json'),
    runtimeDir,
    store: join(runtimeDir, 'store.json'),
    cacheDir: join(neuronDir, 'cache'),
  };
}

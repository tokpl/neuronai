import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { openProjectBrain, resolveBrainPaths, type BrainPrefs } from '@neuronai/brain';

import {
  neuronLocalConfigSchema,
  type NeuronLocalConfig,
  type NeuronMetadata,
  validateLocalConfig,
} from '../config/local-config.js';
import { CLI_VERSION } from '../cli-version.generated.js';

export { CLI_VERSION };

export const NEURON_DIR = '.neuron';

export function neuronPaths(cwd = process.cwd()) {
  const root = resolve(cwd);
  const p = resolveBrainPaths(root);
  return {
    root,
    neuronDir: p.neuronDir,
    config: p.prefs,
    prefs: p.prefs,
    metadata: join(p.neuronDir, 'metadata.json'),
    brainDir: p.brainDir,
    dna: p.dna,
    knowledge: p.knowledge,
    health: p.health,
    runtimeDir: p.runtimeDir,
    store: p.store,
    cacheDir: p.cacheDir,
  };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isNeuronInitialized(cwd = process.cwd()): Promise<boolean> {
  const paths = neuronPaths(cwd);
  return pathExists(paths.prefs);
}

export async function ensureNeuronLayout(cwd = process.cwd()): Promise<void> {
  await openProjectBrain(cwd);
}

export async function loadLocalConfig(cwd = process.cwd()): Promise<NeuronLocalConfig> {
  const brain = await openProjectBrain(cwd);
  if (!brain.prefs) {
    throw new Error('Missing .neuron/prefs.json — run neuron init');
  }
  return validateLocalConfig(brain.prefs);
}

export async function saveLocalConfig(
  config: NeuronLocalConfig,
  cwd = process.cwd(),
): Promise<void> {
  const brain = await openProjectBrain(cwd);
  const parsed = neuronLocalConfigSchema.parse(config);
  await brain.savePrefs(parsed as unknown as BrainPrefs);
}

export async function loadMetadata(cwd = process.cwd()): Promise<NeuronMetadata> {
  const paths = neuronPaths(cwd);
  try {
    return JSON.parse(await readFile(paths.metadata, 'utf8')) as NeuronMetadata;
  } catch {
    return {
      initializedAt: new Date().toISOString(),
      lastSyncAt: null,
      lastAnalyzeAt: null,
      memoryCount: 0,
      version: CLI_VERSION,
    };
  }
}

export async function saveMetadata(metadata: NeuronMetadata, cwd = process.cwd()): Promise<void> {
  const paths = neuronPaths(cwd);
  await mkdir(paths.neuronDir, { recursive: true });
  await writeFile(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

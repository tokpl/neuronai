import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  neuronLocalConfigSchema,
  type NeuronLocalConfig,
  type NeuronMetadata,
  validateLocalConfig,
} from '../config/local-config.js';

export const NEURON_DIR = '.neuron';
export const CLI_VERSION = '0.1.0';

export function neuronPaths(cwd = process.cwd()) {
  const root = resolve(cwd);
  const neuronDir = join(root, NEURON_DIR);
  return {
    root,
    neuronDir,
    config: join(neuronDir, 'config.json'),
    metadata: join(neuronDir, 'metadata.json'),
    dataDir: join(neuronDir, 'data'),
    store: join(neuronDir, 'data', 'store.json'),
    exportDir: join(neuronDir, 'export'),
    integrationsDir: join(neuronDir, 'integrations'),
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
  return pathExists(paths.config);
}

export async function loadLocalConfig(cwd = process.cwd()): Promise<NeuronLocalConfig> {
  const paths = neuronPaths(cwd);
  const raw = JSON.parse(await readFile(paths.config, 'utf8')) as unknown;
  return validateLocalConfig(raw);
}

export async function saveLocalConfig(
  config: NeuronLocalConfig,
  cwd = process.cwd(),
): Promise<void> {
  const paths = neuronPaths(cwd);
  await mkdir(paths.neuronDir, { recursive: true });
  const parsed = neuronLocalConfigSchema.parse(config);
  await writeFile(paths.config, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
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

export async function saveMetadata(
  metadata: NeuronMetadata,
  cwd = process.cwd(),
): Promise<void> {
  const paths = neuronPaths(cwd);
  await mkdir(paths.neuronDir, { recursive: true });
  await writeFile(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

export async function ensureIntegrationStubs(cwd = process.cwd()): Promise<void> {
  const paths = neuronPaths(cwd);
  const hosts = ['cursor', 'claude-code', 'vscode'] as const;
  for (const host of hosts) {
    const dir = join(paths.integrationsDir, host);
    await mkdir(dir, { recursive: true });
    const readme = join(dir, 'README.md');
    if (!(await pathExists(readme))) {
      await writeFile(
        readme,
        [
          `# ${host} integration (extension point)`,
          '',
          'This folder is reserved for host-specific Neuron wiring.',
          'Cursor is implemented via `.cursor/` at the project root.',
          'Claude Code and VS Code adapters will land in a later milestone.',
          '',
        ].join('\n'),
        'utf8',
      );
    }
  }
}

import { access } from 'node:fs/promises';

import { openProjectBrain, resolveBrainPaths, type BrainPaths } from '@neuronai/brain';

import type { StorageStatus } from '../provider.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated use resolveBrainPaths from @neuronai/brain */
export function resolveNeuronPaths(projectRoot: string): BrainPaths {
  return resolveBrainPaths(projectRoot);
}

/**
 * @deprecated Prefer openProjectBrain from @neuronai/brain.
 * Kept for status() helpers and transitional callers.
 */
export class FileStorageProvider {
  readonly name = 'file';

  paths(projectRoot: string): BrainPaths {
    return resolveBrainPaths(projectRoot);
  }

  async ensureLayout(projectRoot: string) {
    return openProjectBrain(projectRoot);
  }

  async status(projectRoot: string): Promise<StorageStatus> {
    const p = this.paths(projectRoot);
    return {
      backend: this.name,
      ready: await exists(p.neuronDir),
      projectRoot: p.projectRoot,
      neuronDir: p.neuronDir,
      note: 'Local filesystem Project Brain — no database or API key required',
    };
  }
}

export function createFileStorageProvider(): FileStorageProvider {
  return new FileStorageProvider();
}

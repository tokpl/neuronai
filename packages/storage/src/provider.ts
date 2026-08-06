import type { BrainPaths, ProjectBrain } from '@neuronai/brain';

export interface StorageStatus {
  backend: string;
  ready: boolean;
  projectRoot: string;
  neuronDir: string;
  note?: string;
}

/**
 * Thin status helper — curated project state lives on ProjectBrain.
 * @deprecated prefer openProjectBrain + brain.status()
 */
export type NeuronStoragePaths = BrainPaths;
export type { ProjectBrain };

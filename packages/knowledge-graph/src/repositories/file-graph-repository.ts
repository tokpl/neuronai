import type { ProjectBrain } from '@neuronai/brain';
import { openProjectBrain } from '@neuronai/brain';

import {
  BrainGraphRepository,
  createBrainGraphRepository,
} from './brain-graph-repository.js';

/** @deprecated Use BrainGraphRepository */
export { BrainGraphRepository as FileGraphRepository };

/**
 * @deprecated Pass a live ProjectBrain via createBrainGraphRepository(brain).
 */
export async function createFileGraphRepository(
  projectRoot: string,
): Promise<BrainGraphRepository> {
  const brain = await openProjectBrain(projectRoot);
  return createBrainGraphRepository(brain);
}

export type { ProjectBrain };

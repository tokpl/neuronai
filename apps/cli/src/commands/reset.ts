import { rm } from 'node:fs/promises';

import { isNeuronInitialized, neuronPaths } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

/**
 * Reset local Neuron memory for this project (destructive).
 */
export async function runReset(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
): Promise<void> {
  ui.title('Neuron reset');
  ui.blank();
  ui.info('This removes local project memory under .neuron/.');
  ui.info('Your source code is never deleted.');
  ui.blank();

  if (!options.force) {
    ui.warn('Refusing to reset without --force');
    ui.suggest('neuron reset --force');
    return;
  }

  if (!(await isNeuronInitialized(cwd))) {
    ui.warn('Neuron is not initialized here.');
    return;
  }

  const paths = neuronPaths(cwd);
  await rm(paths.neuronDir, { recursive: true, force: true });
  ui.success(`Removed ${paths.neuronDir}`);
  ui.suggest('Re-learn the project: neuron init');
}

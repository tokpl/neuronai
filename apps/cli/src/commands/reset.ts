import { runPurge } from './backup.js';
import { ui } from '../ui/output.js';

/**
 * Reset local Neuron memory for this project (destructive).
 * Alias-friendly surface for `neuron purge --force`.
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
  await runPurge(cwd, { force: options.force });
  if (options.force) {
    ui.suggest('Re-learn the project: neuron init');
  }
}

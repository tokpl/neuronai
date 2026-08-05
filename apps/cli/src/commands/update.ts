import { runUpdate as runUpdater } from '../diagnostics/updater.js';
import { runScan } from './scan.js';
import { isNeuronInitialized } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

/**
 * Update local knowledge: schema/brain migrations + optional incremental scan.
 */
export async function runUpdate(
  cwd = process.cwd(),
  options: { knowledge?: boolean } = {},
): Promise<void> {
  await runUpdater(cwd);

  if (options.knowledge !== false && (await isNeuronInitialized(cwd))) {
    ui.blank();
    ui.info('Refreshing project knowledge (incremental scan)…');
    await runScan(cwd, { update: true });
  } else if (!(await isNeuronInitialized(cwd))) {
    ui.warn('Skip knowledge refresh — Neuron is not initialized.');
    ui.suggest('Run: neuron init');
  }
}

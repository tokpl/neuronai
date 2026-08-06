import { openProjectBrain } from '@neuronai/brain';

import { NeuronCliError } from '../diagnostics/errors.js';
import { isNeuronInitialized } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

export async function runBrain(
  cwd = process.cwd(),
  options: { explain?: string } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    throw new NeuronCliError({
      title: 'Project Brain is not initialized',
      reason: 'No .neuron/prefs.json found.',
      solution: 'Run `neuron init` in this project first.',
    });
  }

  const brain = await openProjectBrain(cwd);

  if (options.explain) {
    ui.title('Brain Metric');
    console.log(brain.explainMetric(options.explain));
    return;
  }

  console.log(brain.formatMetricsReport());
}

import { join } from 'node:path';

import { createContinuousProjectIntelligence } from '@neuron-ai-memory/project-intelligence';

import { isNeuronInitialized, neuronPaths } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

export async function runWatch(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const paths = neuronPaths(cwd);
  const intel = createContinuousProjectIntelligence();
  await intel.load(paths.neuronDir);

  ui.title('Neuron watch');
  ui.info('Local-only continuous intelligence. No data leaves this machine.');
  ui.info('Press Ctrl+C to stop.');

  const shutdown = async () => {
    ui.info('Stopping watch…');
    intel.stopWatch();
    await intel.save(paths.neuronDir, cwd);
    ui.success(`Saved ${join(paths.neuronDir, 'continuous-intelligence.json')}`);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  intel.startWatch(cwd, (msg) => {
    ui.info(`  ${msg}`);
  });

  // Keep process alive
  await new Promise(() => undefined);
}

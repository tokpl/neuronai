import { openProjectBrain, runPrime, isPrimed } from '@neuronai/brain';

import { isNeuronInitialized } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

/**
 * Refresh conventions + PROJECT_MAP after stack/script changes.
 * Fresh projects get this automatically from `neuron init` — no /neuron-prime skill.
 */
export async function runPrimeCommand(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  ui.title('Neuron prime (refresh)');
  ui.info('Normally part of `neuron init`. Use this only after package manager / scripts change.');
  ui.step(1, 3, 'Opening Project Brain…');
  const brain = await openProjectBrain(cwd);

  ui.step(2, 3, 'Detecting conventions and writing map…');
  const result = await runPrime(brain);

  ui.step(3, 3, 'Done');
  ui.blank();
  ui.success(`Primed at ${result.primedAt}`);
  ui.kv('Prefs', result.prefsPath);
  ui.kv('Project map', result.projectMapPath);
  if (result.conventions.packageManager) {
    ui.kv('Package manager', result.conventions.packageManager);
  }
  const scripts = Object.entries(result.conventions.scripts).filter(([, v]) => Boolean(v));
  if (scripts.length) {
    ui.blank();
    console.log('Scripts:');
    for (const [k, v] of scripts) {
      console.log(`  ${k}: ${v}`);
    }
  }
  ui.blank();
  ui.info(isPrimed(brain) ? 'Brain is primed.' : 'Prime incomplete — re-run neuron prime.');
  ui.suggest('Gated builds: /neuron-deliver');
}

import { applyDecayFix, findStaleMemories, openProjectBrain } from '@neuronai/brain';

import { isNeuronInitialized } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

/**
 * Report (or archive) memories that reference missing files.
 */
export async function runDecay(
  cwd = process.cwd(),
  options: { fix?: boolean } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  ui.title(options.fix ? 'Neuron decay --fix' : 'Neuron decay');
  const brain = await openProjectBrain(cwd);
  const findings = findStaleMemories(brain);

  if (findings.length === 0) {
    ui.success('No stale file references in active memories.');
    return;
  }

  ui.warn(`${findings.length} memories reference missing files:`);
  for (const f of findings.slice(0, 30)) {
    console.log(`  • ${f.title}`);
    console.log(`    missing: ${f.missingPaths.join(', ')}`);
  }
  if (findings.length > 30) {
    console.log(`  … and ${findings.length - 30} more`);
  }

  if (!options.fix) {
    ui.blank();
    ui.suggest('Archive them with: neuron decay --fix');
    return;
  }

  const result = applyDecayFix(brain);
  await brain.save();
  ui.blank();
  ui.success(`Archived ${result.archived} memories (status=archived).`);
  ui.info('They stay on disk / in knowledge.json for review — not deleted.');
}

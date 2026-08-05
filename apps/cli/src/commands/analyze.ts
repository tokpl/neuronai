import { syncProjectBrainFiles } from '../services/cursor-setup.js';
import { isNeuronInitialized, loadLocalConfig } from '../services/neuron-fs.js';
import { analyzeAndSeedMemories, openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

export async function runAnalyze(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  ui.title('Neuron analyze');
  const config = await loadLocalConfig(cwd);
  const session = await openProjectSession(cwd);

  ui.step(1, 3, 'Scanning structure & dependencies…');
  ui.info(
    `  Stack: ${session.project.frameworks.join(', ') || session.project.languages.join(', ') || 'unknown'}`,
  );
  ui.info(`  Notes: ${session.project.structureNotes.length}`);

  ui.step(2, 3, 'Scoring knowledge with Memory Intelligence…');
  const result = await analyzeAndSeedMemories(session, {
    threshold: config.memory.threshold,
  });

  await syncProjectBrainFiles(cwd);

  ui.step(3, 3, 'Done');
  ui.blank();
  ui.success(
    `Analyzed project — stored ${result.stored} memories (${result.skipped} skipped of ${result.candidates} candidates)`,
  );
  for (const memory of result.memories.slice(0, 8)) {
    ui.info(`  • ${memory.title}`);
  }
  ui.suggest('Project brain updated under .neuron/*.md');
}

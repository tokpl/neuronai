import { join } from 'node:path';

import { isNeuronInitialized } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { syncProjectBrainFiles } from '../services/cursor-setup.js';
import { ui } from '../ui/output.js';

export async function runScan(
  cwd = process.cwd(),
  options: { deep?: boolean; update?: boolean; architecture?: boolean } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const mode = options.architecture
    ? 'architecture'
    : options.update
      ? 'update'
      : options.deep
        ? 'deep'
        : 'fast';

  ui.title('Neuron scan');
  ui.info(`Mode: ${mode}`);
  ui.step(1, 3, 'Analyzing project…');

  const session = await openProjectSession(cwd);

  ui.step(2, 3, 'Learning from the codebase…');
  const { report, memoriesStored, duplicatesSkipped, staleMemoriesRemoved } =
    await session.scan(mode);

  await syncProjectBrainFiles(cwd);

  ui.step(3, 3, 'Done');
  ui.blank();

  if (report.delta) {
    const d = report.delta;
    console.log(
      `✓ ${d.unchanged} unchanged · ${d.changed.length} changed · ${d.added.length} added · ${d.deleted.length} deleted · ${d.reanalyzed ?? 0} reanalyzed`,
    );
    if (report.unchanged) {
      ui.success('Brain already up to date — nothing to re-analyze.');
      return;
    }
  }

  ui.success(
    `Project brain ready — ${memoriesStored} new memories, ${report.relationships} relationships`,
  );
  ui.info(
    `  Modules: ${report.modules} · Services: ${report.services} · Files: ${report.filesScanned}`,
  );
  if (staleMemoriesRemoved > 0) {
    ui.info(`  Removed ${staleMemoriesRemoved} stale scan fact(s)`);
  }
  if (duplicatesSkipped > 0) {
    ui.info(`  Skipped ${duplicatesSkipped} memories already known`);
  }
  ui.info(`  Report: ${join(cwd, '.neuron', 'project-report.md')}`);
  ui.suggest('Review suggested constitution: .neuron/constitution.md');
  ui.suggest('Cursor rules: .cursor/rules/project-patterns.mdc');
}

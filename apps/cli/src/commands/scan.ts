import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createProjectBrainBootstrap } from '@neuron-ai-memory/project-scanner';

import { isNeuronInitialized, loadLocalConfig, neuronPaths } from '../services/neuron-fs.js';
import { analyzeAndSeedMemories, openProjectSession } from '../services/project-session.js';
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

  const config = await loadLocalConfig(cwd);
  const bootstrap = createProjectBrainBootstrap();
  const report = await bootstrap.scan({
    root: cwd,
    mode,
    projectName: config.project.name,
  });

  ui.step(2, 3, 'Seeding memories from scan…');
  try {
    const session = await openProjectSession(cwd);
    // Prefer scan-generated candidates via analyze path as well
    await analyzeAndSeedMemories(session, { threshold: config.memory.threshold });
  } catch {
    ui.warn('Memory store seed skipped (session unavailable)');
  }

  await syncProjectBrainFiles(cwd);

  ui.step(3, 3, 'Done');
  ui.blank();
  ui.success(`Project brain ready — ${report.memoriesCreated} memories, ${report.relationships} relationships`);
  ui.info(`  Modules: ${report.modules} · Services: ${report.services} · Deps: ${report.dependencies}`);
  ui.info(`  Report: ${join(cwd, '.neuron', 'project-report.md')}`);
  ui.suggest('Review suggested constitution: .neuron/constitution.md');
  ui.suggest('Cursor rules: .cursor/rules/project-patterns.mdc');
}

export async function runProjectReport(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  ui.title('Neuron project report');
  const paths = neuronPaths(cwd);
  try {
    const md = await readFile(join(paths.neuronDir, 'project-report.md'), 'utf8');
    console.log(md);
  } catch {
    ui.warn('No project-report.md yet — running a fast scan…');
    await runScan(cwd, {});
    const md = await readFile(join(paths.neuronDir, 'project-report.md'), 'utf8');
    console.log(md);
  }
}

import { createProjectBrainBootstrap } from '@neuronai/project-scanner';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

async function scanAndSyncBrain(
  runtime: NeuronRuntime,
  mode: 'fast' | 'deep' | 'architecture' | 'update',
) {
  const report = await createProjectBrainBootstrap().scan({
    root: runtime.cwd,
    mode,
    projectName: runtime.project.name,
  });

  runtime.brain.seedIdentity({
    projectId: runtime.project.projectId,
    name: runtime.project.name,
    stack: runtime.project.stack,
    summary: typeof report.markdown === 'string' ? report.markdown.slice(0, 500) : undefined,
  });

  if (runtime.persist) {
    await runtime.persist();
  }
  await runtime.brain.evolve();

  return report;
}

export async function handleScanProject(
  runtime: NeuronRuntime,
  args: { mode?: 'fast' | 'deep' | 'architecture' | 'update' },
) {
  try {
    const mode = args.mode ?? 'fast';
    const report = await scanAndSyncBrain(runtime, mode);
    return okResult({
      mode: report.mode,
      projectName: report.projectName,
      modules: report.modules,
      services: report.services,
      dependencies: report.dependencies,
      memoriesCreated: report.memoriesCreated,
      relationships: report.relationships,
      rulesSuggested: report.rulesSuggested,
      stack: report.stack,
      markdown: report.markdown,
      brain: runtime.brain.status(),
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleRefreshBrain(
  runtime: NeuronRuntime,
  _args: Record<string, unknown>,
) {
  try {
    const report = await scanAndSyncBrain(runtime, 'update');
    return okResult({
      refreshed: true,
      mode: 'update',
      memoriesCreated: report.memoriesCreated,
      relationships: report.relationships,
      markdown: report.markdown,
      brain: runtime.brain.status(),
      explain: runtime.brain.explain(),
    });
  } catch (e) {
    return failResult(e);
  }
}

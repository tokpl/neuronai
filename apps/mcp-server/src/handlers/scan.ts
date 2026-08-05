import { createProjectBrainBootstrap } from '@neuronai/project-scanner';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

export async function handleScanProject(
  runtime: NeuronRuntime,
  args: { mode?: 'fast' | 'deep' | 'architecture' | 'update' },
) {
  try {
    const mode = args.mode ?? 'fast';
    const report = await createProjectBrainBootstrap().scan({
      root: runtime.cwd,
      mode,
      projectName: runtime.project.name,
    });
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
    const report = await createProjectBrainBootstrap().scan({
      root: runtime.cwd,
      mode: 'update',
      projectName: runtime.project.name,
    });
    return okResult({
      refreshed: true,
      mode: 'update',
      memoriesCreated: report.memoriesCreated,
      relationships: report.relationships,
      markdown: report.markdown,
    });
  } catch (e) {
    return failResult(e);
  }
}

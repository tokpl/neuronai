import type { ScanMode } from '@neuronai/project-scanner';

import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/** Rebuild the project brain from the codebase. */
export async function handleScan(runtime: McpRuntime, args: { mode?: ScanMode }) {
  try {
    const { report, memoriesStored, duplicatesSkipped } = await runtime.neuron.scan(
      args.mode ?? 'fast',
    );

    return okResult({
      mode: report.mode,
      filesScanned: report.filesScanned,
      modules: report.modules,
      relationships: report.relationships,
      memoriesStored,
      duplicatesSkipped,
      stack: [
        ...report.stack.languages,
        ...report.stack.frontend,
        ...report.stack.backend,
        ...report.stack.database,
      ],
      brain: runtime.neuron.brain.status(),
    });
  } catch (error) {
    return failResult(error);
  }
}

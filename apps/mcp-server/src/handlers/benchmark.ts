import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createBenchmarkPlatform } from '@neuron-ai-memory/benchmark';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/** Lightweight status for Cursor — does not train models or spawn agents. */
export async function handleBenchmarkStatus(
  runtime: NeuronRuntime,
  _args: Record<string, unknown>,
) {
  try {
    const platform = createBenchmarkPlatform();
    let reportExcerpt: string | null = null;
    try {
      reportExcerpt = (await readFile(join(runtime.cwd, 'benchmark-report.md'), 'utf8')).slice(
        0,
        1200,
      );
    } catch {
      reportExcerpt = null;
    }

    return okResult({
      ...platform.status(),
      cwd: runtime.cwd,
      hasReportOnDisk: Boolean(reportExcerpt),
      reportExcerpt,
      commands: {
        full: 'neuron benchmark',
        report: 'neuron benchmark report',
        retrieval: 'neuron benchmark retrieval',
      },
      note: 'Memory-layer evaluation only — no LLM training / autonomous agent.',
    });
  } catch (e) {
    return failResult(e);
  }
}

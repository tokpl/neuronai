import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleAfterTask(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.workflow.afterCoding(args);
    if (result.persisted && runtime.persist) await runtime.persist();
    return okResult({
      ok: true,
      analysis: result.analysis,
      suggestion: result.suggestion,
      quality: result.quality,
      persisted: result.persisted,
      promptText: result.promptText,
      privacyMode: runtime.privacyMode,
    });
  } catch (error) {
    return failResult(error);
  }
}

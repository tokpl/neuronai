import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleUpdateMemory(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    id: string;
    title?: string;
    content?: string;
    reason: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    resolveProjectId(runtime, args.projectId);

    const memory = await runtime.engine.updateMemory({
      id: args.id,
      title: args.title,
      content: args.content,
      reason: args.reason,
      updatedBy: 'agent',
    });

    await runtime.searchEngine.indexMemory(memory);

    return okResult({
      status: 'updated',
      memory,
      note: 'A new version was appended; previous content remains in history.',
    });
  } catch (error) {
    return failResult(error);
  }
}

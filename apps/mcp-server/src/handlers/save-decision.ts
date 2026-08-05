import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleSaveDecision(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    title: string;
    problem: string;
    decision: string;
    reason: string;
    alternatives?: string[];
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);

    const content = [
      `Problem: ${args.problem}`,
      `Decision: ${args.decision}`,
      `Reason: ${args.reason}`,
      args.alternatives?.length
        ? `Alternatives: ${args.alternatives.join('; ')}`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const memory = await runtime.engine.createMemory({
      projectId,
      type: 'architecture_decision',
      title: args.title,
      content,
      source: 'agent',
      tags: ['decision', ...(args.alternatives?.length ? ['has-alternatives'] : [])],
    });

    await runtime.searchEngine.indexMemory(memory);

    return okResult({
      status: 'stored',
      memory,
    });
  } catch (error) {
    return failResult(error);
  }
}

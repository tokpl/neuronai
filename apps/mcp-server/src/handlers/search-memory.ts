import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleSearchMemory(
  runtime: NeuronRuntime,
  args: { projectId?: string; query: string; limit?: number },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);
    const hits = await runtime.searchEngine.search({
      projectId,
      query: args.query,
      limit: args.limit ?? 10,
    });

    return okResult({
      projectId,
      query: args.query,
      memories: hits.map((hit) => ({
        memory: hit.memory,
        score: hit.score,
        confidence: hit.memory.confidenceScore,
        components: hit.components,
        relations: [] as Array<{ type: string; memoryId: string }>,
      })),
    });
  } catch (error) {
    return failResult(error);
  }
}

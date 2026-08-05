import { ValidationError } from '@neuronai/types';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleStoreMemory(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    type: 'knowledge' | 'pattern' | 'mistake' | 'business_rule' | 'dependency' | 'context';
    title: string;
    content: string;
    tags?: string[];
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);

    const outcome = await runtime.pipeline.process({
      projectId,
      kind: 'agent_action',
      text: `${args.title}\n${args.content}`,
      source: 'agent',
      autoPersistAskUser: true,
    });

    const stored = outcome.results.find((r) => r.status === 'stored' || r.status === 'superseded_existing');

    if (stored?.memory) {
      // Ensure requested type if pipeline classified differently - update via explicit create fallback
      if (stored.memory.type !== args.type) {
        try {
          const memory = await runtime.engine.createMemory({
            projectId,
            type: args.type,
            title: args.title,
            content: args.content,
            source: 'agent',
            tags: args.tags,
          });
          await runtime.searchEngine.indexMemory(memory);
          return okResult({ status: 'stored', memory, pipeline: outcome.results });
        } catch (error) {
          if (isDuplicate(error)) {
            return okResult({
              status: 'duplicate',
              memory: stored.memory,
              pipeline: outcome.results,
            });
          }
          throw error;
        }
      }
      await runtime.searchEngine.indexMemory(stored.memory);
      return okResult({ status: stored.status, memory: stored.memory, pipeline: outcome.results });
    }

    // Explicit store when pipeline skipped (e.g. low importance) but agent insisted
    try {
      const memory = await runtime.engine.createMemory({
        projectId,
        type: args.type,
        title: args.title,
        content: args.content,
        source: 'agent',
        tags: args.tags,
      });
      await runtime.searchEngine.indexMemory(memory);
      return okResult({ status: 'stored', memory, pipeline: outcome.results });
    } catch (error) {
      if (isDuplicate(error)) {
        return okResult({
          status: 'duplicate',
          message: error instanceof Error ? error.message : 'duplicate memory detected',
          pipeline: outcome.results,
        });
      }
      throw error;
    }
  } catch (error) {
    return failResult(error);
  }
}

function isDuplicate(error: unknown): boolean {
  if (error instanceof ValidationError && /duplicate/i.test(error.message)) return true;
  return error instanceof Error && /duplicate/i.test(error.message);
}

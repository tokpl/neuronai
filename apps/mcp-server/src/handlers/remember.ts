import { findDuplicate } from '@neuronai/brain';
import type { MemoryType } from '@neuronai/types';

import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/**
 * Store one piece of engineering knowledge.
 * Content-level dedupe runs first: re-saving known knowledge updates it in place.
 */
export async function handleRemember(
  runtime: McpRuntime,
  args: {
    projectId?: string;
    type: MemoryType;
    title: string;
    content: string;
    tags?: string[];
  },
) {
  try {
    const projectId = args.projectId?.trim() || runtime.neuron.project.projectId;
    const existing = runtime.neuron.listMemories();

    const duplicate = findDuplicate(
      { type: args.type, title: args.title, content: args.content },
      existing,
    );

    if (duplicate) {
      const merged = await runtime.neuron.engine.updateMemory({
        id: duplicate.existing.id,
        title: args.title,
        content:
          args.content.length > duplicate.existing.content.length
            ? args.content
            : duplicate.existing.content,
        reason: 'Merged duplicate knowledge submitted by the agent',
      });
      return okResult({
        status: 'merged',
        reason: duplicate.reason,
        memory: { id: merged.id, type: merged.type, title: merged.title },
        message: `Already known — updated "${duplicate.existing.title}" instead of adding a duplicate.`,
      });
    }

    const memory = await runtime.neuron.engine.createMemory({
      projectId,
      type: args.type,
      title: args.title,
      content: args.content,
      source: 'agent',
      tags: args.tags,
    });

    return okResult({
      status: 'stored',
      memory: { id: memory.id, type: memory.type, title: memory.title },
    });
  } catch (error) {
    return failResult(error);
  }
}

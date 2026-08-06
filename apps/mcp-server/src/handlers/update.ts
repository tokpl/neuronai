import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/** Versioned update — the previous content is kept, never silently overwritten. */
export async function handleUpdate(
  runtime: McpRuntime,
  args: { id: string; reason: string; title?: string; content?: string },
) {
  try {
    const memory = await runtime.neuron.engine.updateMemory({
      id: args.id,
      title: args.title,
      content: args.content,
      reason: args.reason,
    });

    return okResult({
      status: 'updated',
      memory: { id: memory.id, type: memory.type, title: memory.title, version: memory.version },
    });
  } catch (error) {
    return failResult(error);
  }
}

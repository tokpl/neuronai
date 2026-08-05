import type { MemoryType } from '@neuronai/types';
import { ValidationError } from '@neuronai/types';

import type { NeuronRuntime, PendingMemorySuggestion } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export type ResolveSuggestionAction = 'save' | 'edit' | 'ignore';

function clearPending(runtime: NeuronRuntime): void {
  runtime.pendingSuggestion = null;
}

function mergePending(
  pending: PendingMemorySuggestion | null,
  args: {
    title?: string;
    content?: string;
    type?: MemoryType;
  },
): PendingMemorySuggestion {
  const title = args.title?.trim() || pending?.title;
  const draftContent = args.content?.trim() || pending?.draftContent;
  const type = args.type ?? pending?.type ?? 'architecture_decision';

  if (!title || !draftContent) {
    throw new ValidationError(
      'No pending suggestion to resolve. Pass title and content, or run neuron_after_task first.',
      { hasPending: Boolean(pending) },
    );
  }

  return {
    type,
    title,
    draftContent,
    reason: pending?.reason ?? 'User confirmed suggestion',
    confidence: pending?.confidence ?? 1,
    task: pending?.task,
  };
}

export async function handleResolveSuggestion(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    action: ResolveSuggestionAction;
    title?: string;
    content?: string;
    type?: MemoryType;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);
    const action = args.action;

    if (action === 'ignore') {
      const hadPending = Boolean(runtime.pendingSuggestion);
      clearPending(runtime);
      return okResult({
        status: 'ignored',
        hadPending,
        message: 'Suggestion discarded. Nothing was saved.',
      });
    }

    if (action === 'edit' && !args.title && !args.content && !args.type) {
      throw new ValidationError(
        'Edit requires at least one of: title, content, type. Or reply with your changes and pass them here.',
      );
    }

    const draft = mergePending(runtime.pendingSuggestion, args);
    const memory = await runtime.engine.createMemory({
      projectId,
      type: draft.type,
      title: draft.title,
      content: draft.draftContent,
      source: 'agent',
      tags: ['user-confirmed', ...(draft.task ? ['after-task'] : [])],
      manualImportance: draft.confidence,
      confidence: draft.confidence,
    });
    await runtime.searchEngine.indexMemory(memory);
    if (runtime.persist) await runtime.persist();
    clearPending(runtime);

    return okResult({
      status: 'stored',
      action,
      memory,
      message:
        action === 'edit'
          ? 'Edited suggestion saved to project memory.'
          : 'Suggestion saved to project memory.',
    });
  } catch (error) {
    return failResult(error);
  }
}

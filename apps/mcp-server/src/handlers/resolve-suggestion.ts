import { ValidationError, type MemoryType } from '@neuronai/types';

import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { handleRemember } from './remember.js';

export type ResolveSuggestionAction = 'save' | 'edit' | 'ignore';

/** Apply the user's answer to the pending ask-before-remember draft. */
export async function handleResolveSuggestion(
  runtime: McpRuntime,
  args: {
    projectId?: string;
    action: ResolveSuggestionAction;
    title?: string;
    content?: string;
    type?: MemoryType;
  },
) {
  try {
    const pending = runtime.pendingSuggestion;

    if (args.action === 'ignore') {
      runtime.pendingSuggestion = null;
      return okResult({ status: 'ignored', message: 'Nothing was saved.' });
    }

    if (args.action === 'edit' && !args.title && !args.content && !args.type) {
      throw new ValidationError('Edit requires at least one of: title, content, type.');
    }

    const title = args.title?.trim() || pending?.title;
    const content = args.content?.trim() || pending?.draftContent;
    const type = args.type ?? pending?.type ?? 'architecture_decision';

    if (!title || !content) {
      throw new ValidationError(
        'No pending suggestion to resolve. Call neuron_after_task first, or pass title and content.',
      );
    }

    const result = await handleRemember(runtime, {
      projectId: args.projectId,
      type,
      title,
      content,
      tags: ['user-confirmed'],
    });

    runtime.pendingSuggestion = null;
    return result;
  } catch (error) {
    return failResult(error);
  }
}

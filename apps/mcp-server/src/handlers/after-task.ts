import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/** Instruct the host agent how to present the confirmation UI. */
export const AFTER_TASK_PRESENT = {
  prefer: 'AskQuestion' as const,
  instruction: [
    'When the Cursor AskQuestion tool is available, call it ONCE with:',
    'title = question.title, prompt = question.prompt, options = question.options.',
    'question.prompt already includes the proposed durable memory BEFORE the confirmation line — do not hide it.',
    'Do NOT paste Yes/Edit/No as a markdown list in chat when AskQuestion is available.',
    'If AskQuestion is unavailable, show question.prompt (or draft.content + the confirmation question) as plain text.',
    'Then call neuron_resolve_suggestion with the user answer (save | edit | ignore).',
  ].join(' '),
};

/**
 * Ask before remembering. Returns a draft and the question to put to the user;
 * nothing is written until neuron_resolve_suggestion.
 *
 * `question.prompt` already embeds the proposed durable memory *before* the
 * confirmation line — agents must show that text (or `draft.content`) before Yes/Edit/No.
 * Prefer Cursor AskQuestion using `question` (see `present`).
 */
export async function handleAfterTask(
  runtime: McpRuntime,
  args: {
    task?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
  },
) {
  try {
    const result = await runtime.workflow.afterCoding(args);

    if (!result.suggestion) {
      runtime.pendingSuggestion = null;
      return okResult({
        suggest: false,
        reason: result.quality?.issues.join('; ') ?? 'Nothing durable to remember.',
      });
    }

    runtime.pendingSuggestion = {
      type: result.suggestion.type,
      title: result.suggestion.title,
      draftContent: result.suggestion.draftContent,
      reason: result.suggestion.reason,
      confidence: result.suggestion.confidence,
      task: args.task,
    };

    return okResult({
      suggest: true,
      persisted: result.persisted ? { id: result.persisted.id } : null,
      draft: {
        type: result.suggestion.type,
        title: result.suggestion.title,
        content: result.suggestion.draftContent,
        reason: result.suggestion.reason,
      },
      question: result.askQuestion,
      present: AFTER_TASK_PRESENT,
    });
  } catch (error) {
    return failResult(error);
  }
}

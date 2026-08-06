import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/**
 * Ask before remembering. Returns a draft and the question to put to the user;
 * nothing is written until neuron_resolve_suggestion.
 *
 * `question.prompt` already embeds the proposed durable memory *before* the
 * confirmation line — agents must show that text (or `draft.content`) before Yes/Edit/No.
 *
 * How the agent should behave also lives in the tool description and the Cursor rule.
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
    });
  } catch (error) {
    return failResult(error);
  }
}

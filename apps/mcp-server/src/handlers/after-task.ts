import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/** Ask-before-remember: user must confirm (privacy suggest / default). */
export const AFTER_TASK_PRESENT_ASK = {
  prefer: 'AskQuestion' as const,
  instruction: [
    'When the Cursor AskQuestion tool is available, call it ONCE with:',
    'title = question.title, prompt = question.prompt, options = question.options.',
    'question.prompt already includes the proposed durable memory BEFORE the confirmation line — do not hide it.',
    'Do NOT paste Yes/Edit/No as a markdown list in chat when AskQuestion is available.',
    'If AskQuestion is unavailable, show question.prompt (or draft.content + the confirmation question) as plain text.',
    'Then call neuron_resolve_suggestion with the user answer (save | edit | ignore).',
    'Separately: if this turn used neuron_context, still append contribution.summary at the end of the reply — autosave / after_task never replaces that footer.',
  ].join(' '),
};

/** Already written (privacy automatic). No Yes/Edit/No — still keep the contribution footer. */
export const AFTER_TASK_PRESENT_SAVED = {
  prefer: 'notice' as const,
  instruction: [
    'This draft was already saved (privacy automatic / autosave).',
    'Do NOT ask Yes/Edit/No and do NOT call AskQuestion for this suggestion.',
    'Briefly tell the user what was saved (draft.title), e.g. “Saved to Project Brain: …”.',
    'If this turn used neuron_context, you MUST still append contribution.summary at the end of the reply.',
    'Autosave never cancels the Neuron contribution footer.',
  ].join(' '),
};

/**
 * Ask before remembering (suggest mode), or report an autosaved draft (automatic).
 *
 * `question.prompt` embeds the proposed durable memory *before* the confirmation line
 * when the user must confirm. When `persisted` is set, `question` is null — no survey.
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

    const alreadySaved = Boolean(result.persisted);

    runtime.pendingSuggestion = alreadySaved
      ? null
      : {
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
      // No confirmation UI when already written — avoids agents inventing “autosave = skip Neuron”.
      question: alreadySaved ? null : result.askQuestion,
      present: alreadySaved ? AFTER_TASK_PRESENT_SAVED : AFTER_TASK_PRESENT_ASK,
    });
  } catch (error) {
    return failResult(error);
  }
}

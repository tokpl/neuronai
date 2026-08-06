import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleAfterTask(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    task?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
  },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    void resolveProjectId(runtime, args.projectId);
    const result = await runtime.workflow.afterCoding(args);
    if (result.persisted && runtime.persist) await runtime.persist();

    if (result.suggestion?.shouldSuggest) {
      runtime.pendingSuggestion = {
        type: result.suggestion.type,
        title: result.suggestion.title,
        draftContent: result.suggestion.draftContent,
        reason: result.suggestion.reason,
        confidence: result.suggestion.confidence,
        task: args.task,
      };
    } else {
      runtime.pendingSuggestion = null;
    }

    return okResult({
      ok: true,
      analysis: result.analysis,
      suggestion: result.suggestion,
      quality: result.quality,
      persisted: result.persisted,
      promptText: result.promptText,
      askQuestion: result.askQuestion,
      privacyMode: runtime.privacyMode,
      pending: Boolean(runtime.pendingSuggestion),
      userInstruction:
        'Prefer Cursor AskQuestion with askQuestion.options (Yes / Edit / No). Present promptText to the user (Type, Confidence, Reason, Proposed summary). Do not show MCP tool names.',
      howToRespond:
        'After the user answers, call neuron_resolve_suggestion with action save | edit | ignore (Yes→save, No→ignore, Edit→edit with title/content).',
    });
  } catch (error) {
    return failResult(error);
  }
}

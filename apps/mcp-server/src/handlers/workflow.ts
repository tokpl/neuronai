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
        'Prefer Cursor AskQuestion with askQuestion.options (Save / Edit first / Ignore). If AskQuestion is unavailable, tell the user in plain language to reply Save, Edit, or Ignore. Do not show MCP tool names to the user.',
      howToRespond:
        'After the user picks or types Save/Edit/Ignore, call neuron_resolve_suggestion with that action.',
    });
  } catch (error) {
    return failResult(error);
  }
}

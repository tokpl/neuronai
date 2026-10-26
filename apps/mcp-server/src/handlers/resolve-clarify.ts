import {
  answerDeliverGate,
  draftClarifyMemory,
  readWorkflowBoard,
  writeWorkflowBoard,
} from '@neuronai/brain';

import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/**
 * Persist the user's answer to a neuron_context clarify question.
 */
export async function handleResolveClarify(
  runtime: McpRuntime,
  args: {
    questionId: string;
    optionId?: string;
    freeText?: string;
    questionPrompt?: string;
    task?: string;
  },
) {
  try {
    const pending = runtime.pendingClarify;
    const draft = draftClarifyMemory({
      questionId: args.questionId,
      optionId: args.optionId,
      freeText: args.freeText,
      questionPrompt: args.questionPrompt ?? pending?.prompt,
      task: args.task ?? pending?.task,
    });

    if (!draft) {
      return okResult({
        ok: true,
        remembered: false,
        reason: 'Empty clarify answer — nothing stored.',
      });
    }

    const memory = await runtime.neuron.engine.createMemory({
      projectId: runtime.neuron.project.projectId,
      type: draft.type,
      title: draft.title,
      content: draft.content,
      source: 'agent',
      tags: draft.tags,
    });

    // Advance pending queue
    if (runtime.pendingClarify) {
      const rest = runtime.pendingClarify.remainingIds.filter((id) => id !== args.questionId);
      runtime.pendingClarify =
        rest.length === 0
          ? null
          : {
              ...runtime.pendingClarify,
              remainingIds: rest,
              prompt: undefined,
            };
    }

    const { cleared } = await answerDeliverGate(runtime.neuron.brain, args.questionId);

    // Persist Thin Brain acknowledgment so the next neuron_context does not re-gate.
    if (args.questionId === 'prime') {
      try {
        const brain = runtime.neuron.brain;
        const prefs = brain.prefs;
        if (prefs) {
          await brain.savePrefs({
            ...prefs,
            workflow: {
              ...prefs.workflow,
              thinBrainAcknowledgedAt: new Date().toISOString(),
            },
          });
        }
      } catch {
        // prefs write is best-effort; gate clear still applies this turn
      }
    }

    // Mirror answer onto active board when present
    try {
      const board = await readWorkflowBoard(runtime.neuron.brain);
      if (board) {
        const answer = (args.optionId ?? args.freeText ?? '').trim();
        const clarifyAnswers = [
          ...(board.clarifyAnswers ?? []).filter((a) => a.questionId !== args.questionId),
          { questionId: args.questionId, answer },
        ];
        await writeWorkflowBoard(
          runtime.neuron.brain,
          {
            ...board,
            clarifyAnswers,
            signals: {
              ...board.signals,
              clarifyQuestionCount: clarifyAnswers.length,
            },
          },
          { previous: board },
        );
      }
    } catch {
      // board update is best-effort during clarify
    }

    return okResult({
      ok: true,
      remembered: true,
      memory: { id: memory.id, type: memory.type, title: memory.title },
      summary: draft.summary,
      remainingClarify: runtime.pendingClarify?.remainingIds ?? [],
      gateCleared: cleared && !runtime.pendingClarify,
      present: {
        codingAllowed: cleared && !runtime.pendingClarify,
        instruction:
          (runtime.pendingClarify?.remainingIds.length ?? 0) > 0
            ? 'More clarify questions remain — AskQuestion for the next one from the last neuron_context clarify list, then neuron_resolve_clarify again.'
            : 'Clarify complete — gate cleared. You may proceed with implementation using Brain context.',
      },
    });
  } catch (error) {
    return failResult(error);
  }
}

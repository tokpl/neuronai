import type { MemoryType } from '@neuronai/types';

export interface ClarifyAnswerInput {
  questionId: string;
  optionId?: string;
  freeText?: string;
  questionPrompt?: string;
  task?: string;
}

export interface ClarifyMemoryDraft {
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  summary: string;
}

/**
 * Build a durable memory draft from a clarify answer (persist via engine / remember).
 */
export function draftClarifyMemory(input: ClarifyAnswerInput): ClarifyMemoryDraft | null {
  const choice = (input.optionId ?? input.freeText ?? '').trim();
  if (!choice) return null;

  const type: MemoryType =
    input.questionId === 'ownership' || input.questionId === 'scope'
      ? 'architecture_decision'
      : 'context';

  const title = `Clarify:${input.questionId} → ${choice.slice(0, 80)}`;
  const content = [
    input.task ? `Task: ${input.task}` : null,
    input.questionPrompt
      ? `Question: ${input.questionPrompt}`
      : `Question id: ${input.questionId}`,
    `Answer: ${choice}`,
    'Source: neuron_resolve_clarify — keep for future sessions.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    type,
    title,
    content,
    tags: ['clarify', input.questionId],
    summary: `Stored clarify answer for ${input.questionId}: ${choice.slice(0, 120)}`,
  };
}

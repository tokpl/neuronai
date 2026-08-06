import type { MemoryType } from '@neuronai/types';

import {
  categoryLabel,
  classifyKnowledge,
  type BrainKnowledgeCategory,
} from '@neuronai/brain';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';
import { confirmationQuestionForType } from './synthesize-durable-memory.js';

export type SuggestionUserAction = 'save' | 'edit' | 'ignore';

export interface SuggestionAskQuestionOption {
  id: SuggestionUserAction;
  label: string;
}

/**
 * Payload shaped for Cursor's AskQuestion tool (title + prompt + options).
 * Agents MUST prefer AskQuestion over pasting options as chat markdown.
 */
export interface SuggestionAskQuestion {
  title: string;
  prompt: string;
  options: SuggestionAskQuestionOption[];
}

export interface UserPromptMessage {
  headline: string;
  body: string;
  options: SuggestionUserAction[];
  /** Compact string for CLI / MCP text fallback when AskQuestion is unavailable */
  text: string;
  /** Prefer presenting this via Cursor AskQuestion when available */
  askQuestion: SuggestionAskQuestion | null;
}

const CONFIRM_OPTIONS: SuggestionAskQuestionOption[] = [
  { id: 'save', label: 'Yes — save this' },
  { id: 'edit', label: 'Edit — change the proposed memory' },
  { id: 'ignore', label: "No — don't save it" },
];

/** Short AskQuestion window title — emoji + product name. */
export const ASK_QUESTION_TITLE = '🧠 Project Brain';

/**
 * Build the ask-before-remember UX.
 * The proposed durable memory MUST appear before the Yes/Edit/No question.
 */
export function formatSuggestionMessage(input: {
  shouldSuggest: boolean;
  type: MemoryType;
  category: BrainKnowledgeCategory;
  categoryLabel: string;
  reason: string;
  confidence: number;
  analysis: CodeChangeAnalysis;
  title: string;
  draftContent: string;
  sectionHeading?: string;
}): UserPromptMessage {
  if (!input.shouldSuggest) {
    const text =
      '🧠 Nothing durable enough for the Project Brain from this change — no architecture decision, pattern, or lasting constraint to store.';
    return {
      headline: 'No suggestion',
      body: text,
      options: ['ignore'],
      text,
      askQuestion: null,
    };
  }

  const sectionHeading = input.sectionHeading ?? '🧠 Project knowledge to remember';
  const proposed = input.draftContent.trim() || input.analysis.summary;
  const confirmQuestion = confirmationQuestionForType(input.type);

  // Visual hierarchy: emoji heading → proposed memory → confirm question.
  const promptBody = [sectionHeading, '', proposed, '', confirmQuestion].join('\n');

  const askQuestion: SuggestionAskQuestion = {
    title: ASK_QUESTION_TITLE,
    prompt: promptBody,
    options: CONFIRM_OPTIONS,
  };

  const text = [
    promptBody,
    '',
    '—',
    'Options:',
    '• Yes — save this',
    '• Edit — change the proposed memory',
    "• No — don't save it",
    '',
    'If you choose Edit, rewrite the proposed memory text (not the implementation).',
  ].join('\n');

  return {
    headline: sectionHeading,
    body: promptBody,
    options: ['save', 'edit', 'ignore'],
    text,
    askQuestion,
  };
}

/** Re-export helpers used by suggestion engine */
export { categoryLabel, classifyKnowledge };
export type { BrainKnowledgeCategory };

import type { MemoryType } from '@neuronai/types';

import {
  categoryLabel,
  classifyKnowledge,
  type BrainKnowledgeCategory,
} from '@neuronai/brain';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';

export type SuggestionUserAction = 'save' | 'edit' | 'ignore';

export interface SuggestionAskQuestionOption {
  id: SuggestionUserAction;
  label: string;
}

/** Shape for Cursor AskQuestion (or equivalent UI picker). */
export interface SuggestionAskQuestion {
  title: string;
  prompt: string;
  options: SuggestionAskQuestionOption[];
}

export interface UserPromptMessage {
  headline: string;
  body: string;
  options: SuggestionUserAction[];
  /** Compact string for CLI / MCP text content (user-facing) */
  text: string;
  /** Prefer presenting this via Cursor AskQuestion when available */
  askQuestion: SuggestionAskQuestion | null;
}

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
}): UserPromptMessage {
  if (!input.shouldSuggest) {
    const text = 'Nothing durable enough for the Project Brain from this change.';
    return {
      headline: 'No suggestion',
      body: text,
      options: ['ignore'],
      text,
      askQuestion: null,
    };
  }

  const confidencePct = Math.round(input.confidence * 100);
  const summary = input.draftContent.trim() || input.analysis.summary;

  const headline = 'I learned something about your project.';
  const body = [
    `Type: ${input.categoryLabel}`,
    `Confidence: ${confidencePct}%`,
    `Reason: ${input.reason}`,
    '',
    'Proposed summary:',
    summary,
  ].join('\n');

  const askQuestion: SuggestionAskQuestion = {
    title: 'Add to Project Brain?',
    prompt: [
      '🧠 I learned something about your project.',
      `Type: ${input.categoryLabel}`,
      `Confidence: ${confidencePct}%`,
      `Reason: ${input.reason}`,
      '',
      'Proposed summary:',
      summary.slice(0, 500),
      '',
      'Save this to the Project Brain?',
    ].join('\n'),
    options: [
      { id: 'save', label: 'Yes' },
      { id: 'edit', label: 'Edit' },
      { id: 'ignore', label: 'No' },
    ],
  };

  const text = [
    '🧠 I learned something about your project.',
    '',
    `Type:`,
    input.categoryLabel,
    '',
    `Confidence:`,
    `${confidencePct}%`,
    '',
    `Reason:`,
    input.reason,
    '',
    `Proposed summary:`,
    '',
    summary,
    '',
    'Reply with:',
    '',
    'Yes',
    '',
    'No',
    '',
    'Edit',
    '',
    'If you reply Edit, rewrite the summary before saving.',
  ].join('\n');

  return {
    headline,
    body,
    options: ['save', 'edit', 'ignore'],
    text,
    askQuestion,
  };
}

/** Re-export helpers used by suggestion engine */
export { categoryLabel, classifyKnowledge };
export type { BrainKnowledgeCategory };

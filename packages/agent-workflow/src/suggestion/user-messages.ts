import type { MemoryType } from '@neuronai/types';

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
  reason: string;
  analysis: CodeChangeAnalysis;
  title: string;
}): UserPromptMessage {
  if (!input.shouldSuggest) {
    const text = 'Nothing important enough to remember from this change.';
    return {
      headline: 'No suggestion',
      body: text,
      options: ['ignore'],
      text,
      askQuestion: null,
    };
  }

  const summary = input.analysis.hasAuthChange
    ? 'You changed how authentication works.'
    : input.analysis.summary;

  const headline = 'Remember this for the project?';
  const body = [input.reason, summary, `About: ${input.title}`].join('\n');

  const askQuestion: SuggestionAskQuestion = {
    title: 'Remember this?',
    prompt: [
      'I can keep this in project memory so the next chat already knows it.',
      `About: ${input.title}`,
      'Should I remember it?',
    ].join('\n'),
    options: [
      { id: 'save', label: 'Yes — remember it' },
      { id: 'edit', label: 'Yes — but let me rephrase first' },
      { id: 'ignore', label: 'No — skip' },
    ],
  };

  const text = [
    'I found something worth keeping in project memory, so the next chat already knows it.',
    '',
    body,
    '',
    'Should I remember this?',
    'Reply: Yes · No · or Yes + your preferred wording if you want to rephrase.',
  ].join('\n');

  return {
    headline,
    body,
    options: ['save', 'edit', 'ignore'],
    text,
    askQuestion,
  };
}

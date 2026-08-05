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
    const text = 'No high-signal engineering knowledge detected for this change.';
    return {
      headline: 'No suggestion',
      body: text,
      options: ['ignore'],
      text,
      askQuestion: null,
    };
  }

  const headline = 'Something worth remembering?';
  const body = [
    input.reason,
    input.analysis.hasAuthChange
      ? 'You modified authentication architecture.'
      : input.analysis.summary,
    `Suggested type: ${input.type}`,
    `Draft title: ${input.title}`,
  ].join('\n');

  const askQuestion: SuggestionAskQuestion = {
    title: 'Save to Neuron memory?',
    prompt: [
      'Neuron wants to remember this for the project.',
      `Draft: ${input.title}`,
      'Pick one option (or choose Edit and then type your changes).',
    ].join('\n'),
    options: [
      { id: 'save', label: 'Save' },
      { id: 'edit', label: 'Edit first' },
      { id: 'ignore', label: 'Ignore' },
    ],
  };

  const text = [
    'Neuron suggests saving this to project memory.',
    '',
    body,
    '',
    'What you should do:',
    'Prefer the on-screen choices if the agent shows AskQuestion.',
    'Otherwise type one of these words in chat (there are no fake buttons):',
    '',
    '  Save   — keep this memory as-is',
    '  Edit   — keep it, but write the changes you want (title/content)',
    '  Ignore — discard; nothing will be stored',
  ].join('\n');

  return {
    headline,
    body,
    options: ['save', 'edit', 'ignore'],
    text,
    askQuestion,
  };
}

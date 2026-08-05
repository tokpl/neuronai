import type { MemoryType } from '@neuronai/types';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';

export type SuggestionUserAction = 'save' | 'edit' | 'ignore';

export interface UserPromptMessage {
  headline: string;
  body: string;
  options: SuggestionUserAction[];
  /** Compact string for CLI / MCP text content */
  text: string;
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
    };
  }

  const headline = 'Detected important architectural change.';
  const body = [
    input.reason,
    input.analysis.hasAuthChange
      ? 'You modified authentication architecture.'
      : input.analysis.summary,
    `Suggested type: ${input.type}`,
    `Would you like to save this as a project decision?`,
    `Draft title: ${input.title}`,
  ].join('\n');

  const text = [
    'Neuron:',
    `"${headline}"`,
    '',
    body,
    '',
    'Options: Save | Edit | Ignore',
  ].join('\n');

  return {
    headline,
    body,
    options: ['save', 'edit', 'ignore'],
    text,
  };
}

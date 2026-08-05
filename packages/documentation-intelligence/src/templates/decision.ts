import type { DecisionDocInput } from '../types.js';

export function decisionTemplate(input: DecisionDocInput): string {
  return [
    `# ${input.id}`,
    '',
    `## ${input.title}`,
    '',
    '## Why',
    '',
    input.why,
    '',
    '## Chosen approach',
    '',
    input.decision,
    '',
    '## Alternatives',
    '',
    ...(input.alternatives?.length
      ? input.alternatives.map((a) => `- ${a}`)
      : ['- (none recorded)']),
    '',
    '## Current status',
    '',
    input.status ?? 'Accepted',
    '',
  ].join('\n');
}

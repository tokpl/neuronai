import type {
  DeveloperSession,
  HandoffDocument,
  TechnicalTaskMemory,
} from '../types.js';

/**
 * Handoff for another developer or future-you — technical state only.
 */
export class HandoffGenerator {
  generate(input: {
    session?: DeveloperSession | null;
    tasks?: TechnicalTaskMemory[];
    risks?: string[];
    decisions?: string[];
  }): HandoffDocument {
    const session = input.session;
    const tasks = input.tasks ?? [];
    const completed = [
      ...(session?.summary ? [session.summary] : []),
      ...tasks.flatMap((t) => t.completed.map((c) => `${t.title}: ${c}`)),
    ];
    const pending = [
      ...(session?.unfinishedWork ?? []),
      ...tasks.flatMap((t) => t.remaining.map((r) => `${t.title}: ${r}`)),
    ];
    const risks = [
      ...(input.risks ?? []),
      ...tasks.flatMap((t) => t.risks),
    ];
    const importantDecisions = [
      ...(input.decisions ?? []),
      ...(session?.decisions ?? []),
      ...tasks.flatMap((t) => t.relatedDecisions),
    ];

    const currentState = session
      ? `Active area: ${session.activeArea}` + (session.branch ? ` (branch ${session.branch})` : '')
      : 'No active session — see pending technical items.';

    const markdown = [
      '# Technical handoff',
      '',
      '## Current state',
      '',
      currentState,
      '',
      '## Completed',
      '',
      ...(completed.length ? completed.map((c) => `- ${c}`) : ['- (none listed)']),
      '',
      '## Pending',
      '',
      ...(pending.length ? pending.map((p) => `- ${p}`) : ['- (none listed)']),
      '',
      '## Risks',
      '',
      ...(risks.length ? risks.map((r) => `- ${r}`) : ['- (none listed)']),
      '',
      '## Important decisions',
      '',
      ...(importantDecisions.length
        ? importantDecisions.map((d) => `- ${d}`)
        : ['- (none listed)']),
      '',
      '## Related files',
      '',
      ...((session?.relatedFiles ?? []).length
        ? (session?.relatedFiles ?? []).map((f) => `- ${f}`)
        : ['- (none listed)']),
      '',
    ].join('\n');

    return {
      currentState,
      completed: unique(completed),
      pending: unique(pending),
      risks: unique(risks),
      importantDecisions: unique(importantDecisions),
      relatedFiles: session?.relatedFiles ?? [],
      branch: session?.branch,
      markdown,
    };
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((i) => i.trim()).filter(Boolean))];
}

export function createHandoffGenerator(): HandoffGenerator {
  return new HandoffGenerator();
}

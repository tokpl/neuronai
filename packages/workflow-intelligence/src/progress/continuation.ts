import type {
  DeveloperSession,
  FocusContext,
  InterruptionRecord,
  ResumePacket,
  TechnicalTaskMemory,
} from '../types.js';

/**
 * Resume technical work context after a break — no private chat replay.
 */
export class ContinuationEngine {
  resume(input: {
    session: DeveloperSession | null;
    tasks?: TechnicalTaskMemory[];
    focus?: FocusContext | null;
    interruption?: InterruptionRecord | null;
    pendingDecisions?: string[];
  }): ResumePacket {
    const session = input.session;
    const tasks = input.tasks ?? [];
    const related = session
      ? tasks.filter((t) => session.relatedTasks.includes(t.id) || overlap(session.activeArea, t.title))
      : tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'BLOCKED').slice(0, 5);

    const lastWorkSummary =
      session?.summary ||
      (session
        ? `Working on ${session.activeArea}` +
          (session.unfinishedWork.length
            ? `; unfinished: ${session.unfinishedWork.join(', ')}`
            : '')
        : 'No prior technical session stored.');

    const nextSuggestedSteps: string[] = [];
    for (const t of related) {
      for (const r of t.remaining.slice(0, 3)) nextSuggestedSteps.push(`${t.title}: ${r}`);
    }
    for (const u of session?.unfinishedWork ?? []) {
      if (!nextSuggestedSteps.includes(u)) nextSuggestedSteps.push(u);
    }
    if (input.interruption) {
      nextSuggestedSteps.push(`Revisit risks: ${input.interruption.whatRemainsRisky.join('; ') || 'review diff'}`);
    }
    if (!nextSuggestedSteps.length) {
      nextSuggestedSteps.push('Confirm active module', 'Run focused tests', 'Update session unfinishedWork');
    }

    return {
      lastWorkSummary,
      changedFiles: session?.relatedFiles ?? [],
      pendingDecisions: [
        ...(input.pendingDecisions ?? []),
        ...(session?.decisions.filter((d) => /pending|open|todo/i.test(d)) ?? []),
      ].slice(0, 10),
      nextSuggestedSteps: nextSuggestedSteps.slice(0, 10),
      activeSession: session,
      focus: input.focus ?? null,
      interruption: input.interruption ?? null,
      branch: session?.branch,
      note: 'Technical resume only — no private chats, PII, or people productivity scores.',
    };
  }
}

function overlap(a: string, b: string): boolean {
  const ta = a.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const bl = b.toLowerCase();
  return ta.some((t) => bl.includes(t));
}

export function createContinuationEngine(): ContinuationEngine {
  return new ContinuationEngine();
}

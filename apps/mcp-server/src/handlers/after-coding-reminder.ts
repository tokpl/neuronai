/**
 * Reminder attached to neuron_context so agents close the remember loop.
 * Kept out of the compiled `context` string so token budgets stay honest.
 */
export const AFTER_CODING_REMINDER = {
  required: true as const,
  tool: 'neuron_after_task' as const,
  /** Moments when the agent must call neuron_after_task before ending the turn. */
  when: [
    'Finished implementing a feature, refactor, or migration',
    'Chose or replaced a library / canonical component / ownership boundary',
    'Established a durable UX or domain rule (e.g. sync policy, numbering scheme)',
    'User accepted an architecture plan and you delivered it',
    'You are about to say "done" / "zaimplementowane" / "wdrożone"',
  ],
  instruction: [
    'REQUIRED after durable work: call neuron_after_task with a short summary before ending.',
    'If suggest=true, present question via AskQuestion (or question.prompt), then neuron_resolve_suggestion.',
    'Do not skip remembering just because the user did not ask — Project Brain is how the next session knows.',
    'Skip only for truly trivial edits (typo, rename, comment).',
  ].join(' '),
};

export type AfterCodingReminder = typeof AFTER_CODING_REMINDER;

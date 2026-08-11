/**
 * How Cursor agents should present Neuron contribution after neuron_context.
 * Mirrors afterCoding / after_task present — UX lives in the tool result.
 */
export const CONTEXT_PRESENT = {
  footer: {
    instruction: [
      'REQUIRED every time this turn used neuron_context: append contribution.summary',
      'exactly once at the end of your user-visible reply (keep the 🌱 and the line break).',
      'Do not skip it. Do not invent numbers. Do not dump raw metrics JSON.',
      'Wording means Project Brain compressed context savings — not Cursor bill savings.',
    ].join(' '),
  },
} as const;

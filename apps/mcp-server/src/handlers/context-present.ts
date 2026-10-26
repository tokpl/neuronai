/**
 * How Cursor agents should present Neuron contribution after neuron_context.
 * Mirrors afterCoding / after_task present — UX lives in the tool result.
 */

export const CONTEXT_FOOTER = {
  instruction: [
    'REQUIRED every time this turn used neuron_context: append contribution.summary',
    'exactly once at the end of your user-visible reply (keep the 🌱 and the line break).',
    'Do not skip it. Do not invent numbers. Do not dump raw metrics JSON.',
    'Wording means Project Brain compressed context savings — not Cursor bill savings.',
    'Autosave / neuron_after_task never replaces or cancels this footer.',
  ].join(' '),
} as const;

/** Legacy static present (footer only) — prefer buildContextPresent. */
export const CONTEXT_PRESENT = {
  footer: CONTEXT_FOOTER,
} as const;

export type ContextPresentClarify = {
  questions: Array<{
    id: string;
    title: string;
    prompt: string;
    options: Array<{ id: string; label: string }>;
  }>;
  recommendPrime: boolean;
  instruction: string;
};

export type ContextPresentGate = {
  required: true;
  reason: string;
  until: 'clarify-answered' | 'prime-recommended';
  instruction: string;
};

const CALL_FIRST = {
  required: true as const,
  instruction: [
    'ORGANIC ADOPTION: Call neuron_context again at the start of any new coding task',
    'before broad exploration (list_dir / grep / whole-tree walks).',
    'Prefer returned paths/rules. If present.clarify or present.gate appears, AskQuestion',
    'and do not write application code until answered; then neuron_resolve_clarify.',
    'After durable work: neuron_after_task. Always append contribution.summary last.',
  ].join(' '),
};

export type ContextPresent = {
  footer: typeof CONTEXT_FOOTER;
  /** Always set — agents must keep calling neuron_context first. */
  callFirst: typeof CALL_FIRST;
  prefer?: 'AskQuestion' | 'continue';
  question?: {
    title: string;
    prompt: string;
    options: Array<{ id: string; label: string }>;
  };
  clarify?: ContextPresentClarify;
  gate?: ContextPresentGate;
  instruction?: string;
  /** Soft product nudges (prime, deliver) when Brain is thin / task is large. */
  nudge?: {
    recommendPrime?: boolean;
    recommendDeliver?: boolean;
    express?: boolean;
    playbook?: string;
    text: string;
  };
  /**
   * Soft pre-code gate: false while present.gate is required / gate.json open.
   * Cursor may also run neuron-gate.mjs (best-effort Write deny while gate.json is open).
   * Agents must still honor codingAllowed — hooks are not universal across hosts.
   */
  codingAllowed?: boolean;
  /** Detected deliver playbook + express path (from Brain clarify). */
  deliver?: {
    playbook?: string;
    express?: boolean;
    checklist?: Array<{ id: string; label: string }>;
    instruction: string;
  };
  /** Agency Onboarding Engineer shape — Brain paths, not a separate agent. */
  orientation?: {
    oneLiner: string;
    fiveMinute: {
      primaryTasks: string;
      primaryInputs: string;
      primaryOutputs: string;
      keyFiles: string[];
      mainPaths: string[];
    };
    deepDive: {
      entryPoints: string[];
      flow: string[];
      filesInspected: string[];
    };
  };
};

const CLARIFY_INSTRUCTION = [
  'Brain returned clarify questions. Prefer Cursor AskQuestion with present.question',
  '(title / prompt / options) for the FIRST question — one at a time.',
  'Do NOT invent architecture or write application code until the user answers',
  '(and any present.gate is cleared). Remaining questions are in present.clarify.questions.',
  'After each answer call neuron_resolve_clarify with questionId + optionId (or freeText).',
  'If AskQuestion is unavailable, show present.question.prompt as plain text and wait.',
  'Still append contribution.summary at the end of the reply.',
].join(' ');

const GATE_INSTRUCTION = [
  'HARD GATE: do not write application code until clarify is answered',
  '(or the user explicitly chooses to continue / skip prime).',
  'Follow present.clarify / present.question first, then neuron_resolve_clarify.',
].join(' ');

export function buildContextPresent(clarify: {
  questions: ContextPresentClarify['questions'];
  askQuestion: ContextPresent['question'] | null;
  gate: { required: boolean; reason: string; until: ContextPresentGate['until'] } | null;
  recommendPrime: boolean;
  recommendDeliver?: boolean;
  playbook?: string;
  express?: boolean;
  checklist?: Array<{ id: string; label: string }>;
  /** When gate.json is open even if this turn has no new questions. */
  gateFileActive?: boolean;
  orientation?: ContextPresent['orientation'];
}): ContextPresent {
  const nudgeParts: string[] = [];
  if (clarify.recommendPrime) {
    nudgeParts.push(
      'Brain map/prefs look incomplete — soft-recommend `neuron init` / `neuron prime` (not a hard gate when knowledge already exists).',
    );
  }
  if (clarify.recommendDeliver) {
    nudgeParts.push(
      'Multi-file / plan-and-build — prefer /neuron-deliver: Brain clarify → board via neuron_workflow → verify Brain scripts → neuron_after_task (Absolute is never installed).',
    );
  }
  if (clarify.express) {
    nudgeParts.push(
      'Express path: Brain already has a start path — short blueprint + propose_waves → verify.',
    );
  }

  const codingAllowed = !(clarify.gate?.required || clarify.gateFileActive);

  const deliverBlock =
    clarify.playbook || clarify.express || clarify.checklist
      ? {
          playbook: clarify.playbook,
          express: clarify.express,
          checklist: clarify.checklist,
          instruction: clarify.express
            ? 'Express deliver: neuron_workflow propose_waves → implement → checklistOk → verify → neuron_after_task.'
            : `Use /neuron-deliver playbook "${clarify.playbook ?? 'build'}"; honor present.deliver.checklist before verifyOk.`,
        }
      : undefined;

  const base: ContextPresent = {
    footer: CONTEXT_FOOTER,
    callFirst: CALL_FIRST,
    codingAllowed,
    nudge: nudgeParts.length
      ? {
          recommendPrime: clarify.recommendPrime || undefined,
          recommendDeliver: clarify.recommendDeliver || undefined,
          express: clarify.express || undefined,
          playbook: clarify.playbook,
          text: nudgeParts.join(' '),
        }
      : undefined,
    deliver: deliverBlock,
    orientation: clarify.orientation,
  };

  if (!clarify.questions.length) {
    const present: ContextPresent = { ...base, prefer: 'continue' };
    if (clarify.gateFileActive) {
      present.gate = {
        required: true,
        reason: 'Open deliver gate on disk — finish remaining clarify answers',
        until: 'clarify-answered',
        instruction: GATE_INSTRUCTION,
      };
      present.codingAllowed = false;
    }
    return present;
  }

  const present: ContextPresent = {
    ...base,
    prefer: 'AskQuestion',
    codingAllowed: false,
    question: clarify.askQuestion ?? undefined,
    clarify: {
      questions: clarify.questions,
      recommendPrime: clarify.recommendPrime,
      instruction: CLARIFY_INSTRUCTION,
    },
    instruction: CLARIFY_INSTRUCTION,
  };

  if (clarify.gate?.required || clarify.gateFileActive) {
    present.gate = {
      required: true,
      reason: clarify.gate?.reason ?? 'Open deliver gate — finish clarify',
      until: clarify.gate?.until ?? 'clarify-answered',
      instruction: GATE_INSTRUCTION,
    };
  }

  return present;
}

import type { DeliverPlaybook } from '../models.js';
import type { ProposedWave } from './propose-waves.js';

/** Thin Agency-inspired scenarios — phases only, not agent rosters. */
export type DeliverRunbook = 'feature' | 'incident' | 'enterprise-change' | 'feedback';

export const DELIVER_RUNBOOKS: DeliverRunbook[] = [
  'feature',
  'incident',
  'enterprise-change',
  'feedback',
];

export function isDeliverRunbook(value: string | undefined): value is DeliverRunbook {
  return Boolean(value && (DELIVER_RUNBOOKS as string[]).includes(value));
}

/** Detect named coding scenario from task text (mirrors detectPlaybook). */
export function detectRunbook(task: string, explicit?: DeliverRunbook): DeliverRunbook {
  if (explicit) return explicit;
  const t = task.toLowerCase();
  if (
    /\bfeedback\b/.test(t) ||
    /\b(lista\s+punkt|feedback\s+\d|triage)\b/.test(t) ||
    (/(?:^|\n)\s*\d{1,3}[a-z]?[).:\-]\s+\S+/m.test(task) &&
      (task.match(/(?:^|\n)\s*\d{1,3}[a-z]?[).:\-]\s+/gm)?.length ?? 0) >= 3)
  ) {
    return 'feedback';
  }
  if (
    /\b(incident|outage|p0|p1|sev[-\s]?[0-2]|hotfix|regression|on[- ]?call|postmortem|reproduce)\b/.test(
      t,
    )
  ) {
    return 'incident';
  }
  if (
    /\b(enterprise|compliance|soc2|hipaa|risk|security review|change advisory|cab)\b/.test(t)
  ) {
    return 'enterprise-change';
  }
  return 'feature';
}

/**
 * Re-shape code/map-grounded waves into a runbook phase order.
 * Paths stay from proposeDeliverWaves; titles/tasks follow the scenario.
 */
export function applyRunbook(
  runbook: DeliverRunbook,
  baseWaves: ProposedWave[],
  input: { goal: string; seedPath: string | null; playbook: DeliverPlaybook },
): ProposedWave[] {
  const paths = collectPaths(baseWaves);
  const verifyTasks =
    baseWaves.find((w) => /verify/i.test(w.title))?.tasks ??
    ['Run project verify scripts from Brain prefs'];

  if (runbook === 'feedback') {
    return [
      {
        id: 'w1',
        title: 'Ingest feedback',
        status: 'pending',
        paths: paths.slice(0, 4),
        tasks: [
          `Parse numbered list → signals.feedbackItems (fb-1, fb-12b, …): ${input.goal.slice(0, 120)}`,
          'No code changes this wave',
          'Group by screen/flow when possible (Feed, Chat, Tasks, …)',
        ],
      },
      {
        id: 'w2',
        title: 'Reproduce in product',
        status: 'pending',
        dependsOn: ['w1'],
        paths: paths.slice(0, 6),
        tasks: [
          'Open the real product: Flutter+adb OR Next/browser OR PHP app — stack-agnostic',
          'Navigate each item — never “fixed” from reading source alone',
          'Save before PNGs under .neuron/workflow/evidence/fb-<id>/before*.png',
          'Status: confirmed | cannot_repro | by_design | needs_info',
          'If unclear how it should work: AskQuestion → set needs_info + askPrompt; wait for userAnswer',
        ],
      },
      {
        id: 'w3',
        title: 'Fix confirmed',
        status: 'pending',
        dependsOn: ['w2'],
        paths: paths.slice(0, 8),
        tasks: [
          'Fix ONLY items with status confirmed (after userAnswer if they were needs_info)',
          'Blocked while any needs_info lacks userAnswer',
          input.seedPath ? `Prefer paths near ${input.seedPath}` : 'Ground paths from Brain map',
        ],
      },
      {
        id: 'w4',
        title: 'Re-verify with evidence',
        status: 'pending',
        dependsOn: ['w3'],
        tasks: [
          'after*.png per fixed item + vision-reviewed notes (Read the images)',
          'complete_checklist with FEEDBACK_CHECKLIST + existing file paths',
          'Mark fixed items verified',
          ...verifyTasks.slice(0, 2),
        ],
      },
      {
        id: 'w5',
        title: 'Remember',
        status: 'pending',
        dependsOn: ['w4'],
        tasks: [
          'neuron_after_task: durable UX rules from this feedback batch',
          'Set board remembered=true',
        ],
      },
    ];
  }

  if (runbook === 'incident') {
    return [
      {
        id: 'w1',
        title: 'Reproduce',
        status: 'pending',
        paths: paths.slice(0, 4),
        tasks: [
          `Reproduce: ${input.goal}`,
          input.seedPath ? `Start at ${input.seedPath}` : 'Ground failing path from Brain',
          'Capture failing command / log / screenshot path for checklistNotes',
        ],
      },
      {
        id: 'w2',
        title: 'Fix',
        status: 'pending',
        dependsOn: ['w1'],
        paths: paths.slice(0, 8),
        tasks: [
          'Minimal fix for the reproduced failure',
          'No unrelated refactors',
          'Keep change inside impact paths',
        ],
      },
      {
        id: 'w3',
        title: 'Verify',
        status: 'pending',
        dependsOn: ['w2'],
        paths: paths.filter((p) => /test/i.test(p)).slice(0, 4),
        tasks: verifyTasks,
      },
      {
        id: 'w4',
        title: 'Remember postmortem',
        status: 'pending',
        dependsOn: ['w3'],
        tasks: [
          'Draft durable postmortem memory (root cause + guardrail)',
          'Call neuron_after_task before board remembered=true',
        ],
      },
    ];
  }

  if (runbook === 'enterprise-change') {
    return [
      {
        id: 'w1',
        title: 'Scope and risk',
        status: 'pending',
        paths: paths.slice(0, 4),
        tasks: [
          `Scope: ${input.goal}`,
          'List blast radius / dependents from Brain code impact',
          'Note compliance or security constraints for checklistNotes',
        ],
      },
      {
        id: 'w2',
        title: 'Implement',
        status: 'pending',
        dependsOn: ['w1'],
        paths: paths.slice(0, 8),
        tasks: [
          input.seedPath ? `Implement starting at ${input.seedPath}` : 'Implement within Brain paths',
          'Honor wave paths — no silent scope creep',
        ],
      },
      {
        id: 'w3',
        title: 'Security checklist',
        status: 'pending',
        dependsOn: ['w2'],
        paths: paths.slice(0, 6),
        tasks: [
          'Authz / secrets / injection pass for touched surfaces',
          'Record evidence paths in checklistNotes',
          input.playbook === 'ui' || input.playbook === 'mobile'
            ? 'Also cover device/UI evidence notes'
            : 'Cover build checklist notes',
        ],
      },
      {
        id: 'w4',
        title: 'Verify',
        status: 'pending',
        dependsOn: ['w3'],
        tasks: verifyTasks,
      },
    ];
  }

  // feature — clarify → implement → verify (default build shape, lightly labeled)
  if (baseWaves.length === 0) {
    return [
      {
        id: 'w1',
        title: 'Clarify then implement',
        status: 'pending',
        paths: paths.length ? paths.slice(0, 8) : undefined,
        tasks: [
          `Clarify acceptance for: ${input.goal}`,
          input.seedPath ? `Implement starting at ${input.seedPath}` : 'Ground paths from Brain map',
        ],
      },
      {
        id: 'w2',
        title: 'Verify',
        status: 'pending',
        dependsOn: ['w1'],
        tasks: verifyTasks,
      },
    ];
  }

  return baseWaves.map((w, i) => {
    if (i !== 0) return w;
    const clarify = `Clarify acceptance for: ${input.goal}`;
    const tasks = w.tasks.some((t) => t.toLowerCase().startsWith('clarify'))
      ? w.tasks
      : [clarify, ...w.tasks].slice(0, 6);
    return {
      ...w,
      title: w.title === 'Implement' ? 'Implement (feature)' : w.title,
      tasks,
    };
  });
}

function collectPaths(waves: ProposedWave[]): string[] {
  const out: string[] = [];
  for (const w of waves) {
    for (const p of w.paths ?? []) {
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { DeliverPlaybook, FeedbackItem } from '../models.js';
import { missingEvidenceFiles } from './evidence.js';

type RunbookHint = string | null | undefined;

export interface PlaybookChecklistItem {
  id: string;
  label: string;
}

/**
 * Feedback triage checklist — stack-agnostic (Flutter phone, Next.js, PHP, …).
 * Used whenever signals.runbook === 'feedback' (or legacy playbook mobile).
 */
export const FEEDBACK_CHECKLIST: PlaybookChecklistItem[] = [
  {
    id: 'surface-online',
    label: 'Product surface reachable (browser URL / adb device / PHP app) — note how you connected',
  },
  {
    id: 'repro-in-product',
    label: 'Each triage item reproduced in the running product (not code-only reading)',
  },
  {
    id: 'screenshots-before',
    label: 'Before screenshot(s) under .neuron/workflow/evidence/fb-*/ (path must exist)',
  },
  {
    id: 'screenshots-after',
    label: 'After screenshot(s) for fixed items under evidence/ (path must exist)',
  },
  {
    id: 'vision-reviewed',
    label: 'Read() images and wrote 1–3 sentences of what is visible per key item',
  },
  {
    id: 'asks-resolved',
    label: 'Every needs_info item has userAnswer (or was reclassified) — no open questions',
  },
  {
    id: 'no-fantasy',
    label: 'No fantasy “fixed/done” without evidence files + vision notes',
  },
];

/**
 * Engines-lite checklists. Agents must pass every id via signals.checklistDone.
 * For build/ui/feedback, notes are required; feedback also requires existing PNG paths.
 */
const CHECKLISTS: Record<DeliverPlaybook, PlaybookChecklistItem[]> = {
  build: [
    { id: 'scripts-green', label: 'Ran Brain/project scripts (test/lint/typecheck) and fixed in-scope failures' },
    { id: 'blueprint-diff', label: 'Diff vs approved blueprint written; gaps called out explicitly' },
    { id: 'paths-honored', label: 'Edits stayed inside wave paths / Brain modules (no silent scope creep)' },
    {
      id: 'no-fantasy',
      label: 'No fantasy certification (no production-ready / 98/100 / zero-issues without evidence)',
    },
  ],
  ui: [
    { id: 'tokens', label: 'Used project CSS variables / existing type+color scale (no new random palette)' },
    { id: 'a11y', label: 'Semantic HTML, focusable controls, labels, WCAG AA contrast checked' },
    { id: 'no-slop', label: 'No default AI look (purple gradients, cream+terracotta, Inter-only, glow pills)' },
    { id: 'responsive', label: 'Verified desktop + mobile first viewport composition' },
    { id: 'motion', label: '2–3 intentional motions max; no decorative noise' },
    {
      id: 'journey-ok',
      label: 'Primary user journey checked (entry → action → result) with what was verified',
    },
    {
      id: 'no-fantasy',
      label: 'No fantasy certification (no production-ready / luxury / zero-issues without evidence)',
    },
  ],
  /** @deprecated Use runbook feedback + FEEDBACK_CHECKLIST. Kept for old boards. */
  mobile: FEEDBACK_CHECKLIST,
  docs: [
    { id: 'cited', label: 'Every factual claim cites brainRef title/path or an opened source file' },
    { id: 'diataxis', label: 'Doc type is clearly tutorial / how-to / reference / explanation' },
    { id: 'no-invent', label: 'No invented APIs/modules — verified against Brain or source' },
    { id: 'outdated', label: 'Removed or flagged outdated statements vs current code' },
  ],
  polish: [
    { id: 'no-scope', label: 'Diff scope unchanged — no new features while polishing' },
    { id: 'hold-churn', label: 'Low-value renames/format-only churn held or justified' },
    { id: 'complexity', label: 'Nesting/branches reduced where touched; dead code removed with evidence' },
    { id: 'tests-still', label: 'Existing tests still green after polish' },
  ],
  maintain: [
    { id: 'one-family', label: 'Exactly one family this wave: deps | harden | trim | stabilize' },
    { id: 'no-silent-majors', label: 'Majors gated; changelog read; no silent major bumps' },
    { id: 'lockfile', label: 'Lockfile regenerated and committed intent noted' },
    { id: 'verify-scripts', label: 'Project lint/typecheck/test ran after maintain wave' },
  ],
};

/** Normalize legacy mobile playbook → ui (proof lives on feedback runbook). */
export function normalizePlaybook(playbook: DeliverPlaybook | undefined): DeliverPlaybook {
  if (playbook === 'mobile') return 'ui';
  return playbook ?? 'build';
}

/**
 * Checklist for this board: feedback runbook always uses FEEDBACK_CHECKLIST
 * (Flutter, Next.js, PHP — same loop).
 */
export function resolveDeliverChecklist(
  playbook: DeliverPlaybook | undefined,
  runbook?: RunbookHint,
): PlaybookChecklistItem[] {
  if (runbook === 'feedback' || playbook === 'mobile') return FEEDBACK_CHECKLIST;
  return playbookChecklist(normalizePlaybook(playbook));
}

export function playbookRequiresEvidenceNotes(
  playbook: DeliverPlaybook | undefined,
  runbook?: RunbookHint,
): boolean {
  if (runbook === 'feedback' || playbook === 'mobile') return true;
  const p = normalizePlaybook(playbook);
  return p === 'build' || p === 'ui';
}

/** Feedback (and legacy mobile) require referenced evidence files on disk. */
export function playbookRequiresEvidenceFiles(
  playbook: DeliverPlaybook | undefined,
  runbook?: RunbookHint,
): boolean {
  return runbook === 'feedback' || playbook === 'mobile';
}

export function playbookChecklist(playbook: DeliverPlaybook = 'build'): PlaybookChecklistItem[] {
  return CHECKLISTS[playbook] ?? CHECKLISTS.build;
}

export function missingChecklistIds(
  playbook: DeliverPlaybook | undefined,
  done: string[] | undefined,
  runbook?: RunbookHint,
): string[] {
  const required = resolveDeliverChecklist(playbook, runbook).map((c) => c.id);
  const have = new Set(done ?? []);
  return required.filter((id) => !have.has(id));
}

export function missingEvidenceNotes(
  playbook: DeliverPlaybook | undefined,
  done: string[] | undefined,
  notes: Record<string, string> | undefined,
  runbook?: RunbookHint,
): string[] {
  if (!playbookRequiresEvidenceNotes(playbook, runbook)) return [];
  const required = resolveDeliverChecklist(playbook, runbook).map((c) => c.id);
  const doneSet = new Set(done ?? []);
  const idsToCheck =
    missingChecklistIds(playbook, done, runbook).length === 0
      ? required
      : required.filter((id) => doneSet.has(id));
  return idsToCheck.filter((id) => (notes?.[id]?.trim() ?? '').length < 3);
}

export function checklistComplete(
  playbook: DeliverPlaybook | undefined,
  done: string[] | undefined,
  notes?: Record<string, string>,
  options?: {
    projectRoot?: string;
    evidenceDir?: string;
    feedbackItems?: FeedbackItem[];
    runbook?: RunbookHint;
  },
): boolean {
  const runbook = options?.runbook;
  if (missingChecklistIds(playbook, done, runbook).length > 0) return false;
  if (missingEvidenceNotes(playbook, done, notes, runbook).length > 0) return false;
  if (playbookRequiresEvidenceFiles(playbook, runbook) && options?.projectRoot) {
    if (
      missingEvidenceFiles({
        requireScreenshotNotes: true,
        notes,
        feedbackItems: options.feedbackItems,
        projectRoot: options.projectRoot,
        evidenceDir: options.evidenceDir,
      }).length > 0
    ) {
      return false;
    }
  }
  return true;
}

export {
  extractEvidencePathsFromNotes,
  missingEvidenceFiles,
  feedbackHasConfirmed,
  feedbackHasOpenAsks,
  parseFeedbackItems,
} from './evidence.js';

export function defaultEvidenceDir(projectRoot: string): string {
  return join(projectRoot, '.neuron', 'workflow', 'evidence');
}

export function evidenceDirExists(projectRoot: string, evidenceDir?: string): boolean {
  return existsSync(evidenceDir ?? defaultEvidenceDir(projectRoot));
}

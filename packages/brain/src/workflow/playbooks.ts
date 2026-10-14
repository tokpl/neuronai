import type { DeliverPlaybook } from '../models.js';

export interface PlaybookChecklistItem {
  id: string;
  label: string;
}

/**
 * Engines-lite: concrete Absolute-depth checks that still live inside deliver.
 * Agents must pass every id via signals.checklistDone before checklistOk.
 */
const CHECKLISTS: Record<DeliverPlaybook, PlaybookChecklistItem[]> = {
  build: [
    { id: 'scripts-green', label: 'Ran Brain/project scripts (test/lint/typecheck) and fixed in-scope failures' },
    { id: 'blueprint-diff', label: 'Diff vs approved blueprint written; gaps called out explicitly' },
    { id: 'paths-honored', label: 'Edits stayed inside wave paths / Brain modules (no silent scope creep)' },
  ],
  ui: [
    { id: 'tokens', label: 'Used project CSS variables / existing type+color scale (no new random palette)' },
    { id: 'a11y', label: 'Semantic HTML, focusable controls, labels, WCAG AA contrast checked' },
    { id: 'no-slop', label: 'No default AI look (purple gradients, cream+terracotta, Inter-only, glow pills)' },
    { id: 'responsive', label: 'Verified desktop + mobile first viewport composition' },
    { id: 'motion', label: '2–3 intentional motions max; no decorative noise' },
  ],
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

export function playbookChecklist(playbook: DeliverPlaybook = 'build'): PlaybookChecklistItem[] {
  return CHECKLISTS[playbook] ?? CHECKLISTS.build;
}

/** Missing checklist ids required before checklistOk. */
export function missingChecklistIds(
  playbook: DeliverPlaybook | undefined,
  done: string[] | undefined,
): string[] {
  const required = playbookChecklist(playbook ?? 'build').map((c) => c.id);
  const have = new Set(done ?? []);
  return required.filter((id) => !have.has(id));
}

export function checklistComplete(
  playbook: DeliverPlaybook | undefined,
  done: string[] | undefined,
): boolean {
  return missingChecklistIds(playbook, done).length === 0;
}

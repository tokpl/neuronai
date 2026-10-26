import { existsSync } from 'node:fs';
import { isAbsolute, join, normalize, resolve } from 'node:path';

import type { FeedbackItem } from '../models.js';

const PATH_LIKE =
  /(?:^|[\s`"'(])((?:\.neuron[/\\]workflow[/\\]evidence[/\\]|evidence[/\\])[^\s`"',)]+\.(?:png|webp|jpg|jpeg|json))/gi;

const SCREENSHOT_NOTE_IDS = new Set(['screenshots-before', 'screenshots-after']);

/** Pull evidence file paths mentioned in checklist notes. */
export function extractEvidencePathsFromNotes(
  notes: Record<string, string> | undefined,
): string[] {
  if (!notes) return [];
  const out: string[] = [];
  for (const note of Object.values(notes)) {
    if (!note) continue;
    const trimmed = note.trim();
    if (/\.(png|webp|jpe?g|json)$/i.test(trimmed) && /evidence/i.test(trimmed)) {
      if (!out.includes(trimmed)) out.push(trimmed);
    }
    PATH_LIKE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PATH_LIKE.exec(note)) !== null) {
      const p = m[1];
      if (p && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

function resolveEvidencePath(projectRoot: string, evidenceDir: string, raw: string): string {
  const cleaned = raw.replace(/^[`"']+|[`"']+$/g, '');
  if (isAbsolute(cleaned)) return normalize(cleaned);
  if (cleaned.startsWith('.neuron/') || cleaned.startsWith('.neuron\\')) {
    return normalize(join(projectRoot, cleaned));
  }
  if (cleaned.startsWith('evidence/') || cleaned.startsWith('evidence\\')) {
    return normalize(join(evidenceDir, cleaned.replace(/^evidence[/\\]/, '')));
  }
  return normalize(resolve(projectRoot, cleaned));
}

/**
 * Paths referenced in notes / feedback items that do not exist on disk.
 * When requireScreenshotNotes, screenshots-before/after must each cite an existing image.
 */
export function missingEvidenceFiles(input: {
  /** @deprecated use requireScreenshotNotes */
  playbook?: string;
  requireScreenshotNotes?: boolean;
  notes?: Record<string, string>;
  feedbackItems?: FeedbackItem[];
  projectRoot: string;
  evidenceDir?: string;
}): string[] {
  const evidenceDir = input.evidenceDir ?? join(input.projectRoot, '.neuron', 'workflow', 'evidence');
  const missing: string[] = [];
  const requireShots =
    input.requireScreenshotNotes ||
    input.playbook === 'mobile' ||
    input.playbook === 'feedback';

  const check = (raw: string) => {
    const abs = resolveEvidencePath(input.projectRoot, evidenceDir, raw);
    if (!existsSync(abs) && !missing.includes(raw)) missing.push(raw);
  };

  for (const p of extractEvidencePathsFromNotes(input.notes)) check(p);

  if (requireShots && input.notes) {
    for (const id of SCREENSHOT_NOTE_IDS) {
      const note = input.notes[id]?.trim() ?? '';
      if (!note) continue;
      const paths = extractEvidencePathsFromNotes({ [id]: note });
      if (paths.length === 0) {
        if (!missing.includes(`(no path in ${id})`)) missing.push(`(no path in ${id})`);
      } else {
        for (const p of paths) check(p);
      }
    }
  }

  for (const item of input.feedbackItems ?? []) {
    for (const p of item.evidenceBefore ?? []) check(p);
    for (const p of item.evidenceAfter ?? []) check(p);
  }

  return missing;
}

/** True when feedback fix is allowed (at least one confirmed / fixed / verified). */
export function feedbackHasConfirmed(items: FeedbackItem[] | undefined): boolean {
  if (!items?.length) return false;
  return items.some((i) => ['confirmed', 'fixed', 'verified'].includes(i.status));
}

/** Open needs_info items waiting for the user (no userAnswer yet). */
export function feedbackHasOpenAsks(items: FeedbackItem[] | undefined): boolean {
  if (!items?.length) return false;
  return items.some(
    (i) => i.status === 'needs_info' && !(i.userAnswer && i.userAnswer.trim().length > 0),
  );
}

/**
 * Parse numbered feedback lists (PL/EN), including `12b)` suffixes and
 * headers like `Feedback 21.10.2026_2`.
 */
export function parseFeedbackItems(text: string): FeedbackItem[] {
  const lines = text.split(/\r?\n/);
  const items: FeedbackItem[] = [];
  const re = /^\s*(\d{1,3})([a-z]?)[).:-]\s*(.+)$/i;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const n = m[1]!;
    const letter = (m[2] ?? '').toLowerCase();
    const body = m[3]!.trim();
    if (body.length < 3) continue;
    const id = `fb-${n}${letter}`;
    if (items.some((i) => i.id === id)) continue;
    items.push({
      id,
      text: body.slice(0, 800),
      status: 'pending_triage',
      surface: 'unknown',
    });
  }
  return items;
}

import { nowIso, type ProjectConstitutionDocument } from '../rules/types.js';

export interface EvolutionReview {
  shouldReview: boolean;
  commitsSinceReview: number;
  outdatedRules: string[];
  newPatterns: string[];
  architectureConflicts: string[];
  message: string;
}

const DEFAULT_COMMIT_THRESHOLD = 50;

/**
 * Periodic self-review prompt — advisor only; never auto-mutates constitution.
 */
export class PeriodicReview {
  evaluate(
    doc: ProjectConstitutionDocument,
    input: {
      commitsSinceReview?: number;
      newPatternSummaries?: string[];
      threshold?: number;
    } = {},
  ): EvolutionReview {
    const commits = input.commitsSinceReview ?? doc.commitsSinceReview ?? 0;
    const threshold = input.threshold ?? DEFAULT_COMMIT_THRESHOLD;
    const outdated = doc.rules
      .filter((r) => r.status === 'outdated' || (r.status === 'active' && r.confidence < 0.35))
      .map((r) => r.rule);
    const suggestedStale = doc.rules.filter((r) => r.status === 'suggested').length;
    const conflicts = findConflicts(doc);
    const newPatterns = input.newPatternSummaries ?? [];

    const shouldReview =
      commits >= threshold ||
      outdated.length > 0 ||
      conflicts.length > 0 ||
      (newPatterns.length >= 2 && suggestedStale > 0);

    const message = shouldReview
      ? [
          'Project evolved.',
          `Found:`,
          `${outdated.length} outdated rules`,
          `${newPatterns.length} new patterns`,
          `${conflicts.length} architecture conflicts`,
          suggestedStale ? `${suggestedStale} pending suggestions` : undefined,
          'Review?',
        ]
          .filter(Boolean)
          .join('\n')
      : `No periodic review needed yet (${commits}/${threshold} commits).`;

    return {
      shouldReview,
      commitsSinceReview: commits,
      outdatedRules: outdated,
      newPatterns,
      architectureConflicts: conflicts,
      message,
    };
  }

  markReviewed(doc: ProjectConstitutionDocument): ProjectConstitutionDocument {
    return {
      ...doc,
      lastReviewAt: nowIso(),
      commitsSinceReview: 0,
      updatedAt: nowIso(),
    };
  }
}

function findConflicts(doc: ProjectConstitutionDocument): string[] {
  const active = doc.rules.filter((r) => r.status === 'active');
  const conflicts: string[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.category !== b.category) continue;
      if (/do not|never|avoid/i.test(a.rule) && /must|always|prefer/i.test(b.rule)) {
        const ta = a.rule.toLowerCase();
        const tb = b.rule.toLowerCase();
        const overlap = ta.split(/\W+/).filter((w) => w.length > 4 && tb.includes(w));
        if (overlap.length >= 2) {
          conflicts.push(`Possible tension: "${short(a.rule)}" vs "${short(b.rule)}"`);
        }
      }
    }
  }
  return conflicts.slice(0, 10);
}

function short(s: string): string {
  return s.length > 60 ? `${s.slice(0, 59)}…` : s;
}

export function createPeriodicReview(): PeriodicReview {
  return new PeriodicReview();
}

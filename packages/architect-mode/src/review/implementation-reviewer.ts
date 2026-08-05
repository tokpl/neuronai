import type {
  ImplementationPlan,
  ImplementationReview,
  ProjectMemoryContext,
} from '../types.js';

/**
 * Review actual changes vs original plan — advisory only.
 */
export class ImplementationReviewer {
  review(input: {
    changeSummary?: string;
    changedPaths?: string[];
    priorPlan?: ImplementationPlan;
    memory?: ProjectMemoryContext;
  }): ImplementationReview {
    const summary = (input.changeSummary ?? '').toLowerCase();
    const paths = (input.changedPaths ?? []).map((p) => p.replace(/\\/g, '/'));
    const issues: string[] = [];
    const duplicatedLogic: string[] = [];
    const brokenPatterns: string[] = [];

    const planTitles = (input.priorPlan?.steps ?? []).map((s) => s.title.toLowerCase());
    let covered = 0;
    for (const step of planTitles) {
      if (
        (/database|schema|migrat/.test(step) && paths.some((p) => /schema|migrat|prisma|sql/i.test(p))) ||
        (/backend|service/.test(step) && paths.some((p) => /service/i.test(p))) ||
        (/api|endpoint/.test(step) && paths.some((p) => /controller|route|api/i.test(p))) ||
        (/frontend|ui/.test(step) && paths.some((p) => /\.tsx$|component|frontend/i.test(p))) ||
        (/test/.test(step) && paths.some((p) => /test|spec/i.test(p))) ||
        (/doc/.test(step) && paths.some((p) => /\.md$/i.test(p)))
      ) {
        covered += 1;
      }
    }
    const planCompliance =
      planTitles.length === 0 ? 0.6 : Math.min(1, covered / Math.max(1, planTitles.length));

    if (paths.some((p) => /controller/i.test(p)) && /prisma|sql|business/i.test(summary)) {
      brokenPatterns.push('Possible business logic in controllers');
      issues.push('Architecture compliance: move domain logic to services');
    }

    for (const mistake of input.memory?.mistakes ?? []) {
      if (summary.includes('bypass') || /direct db/i.test(mistake)) {
        brokenPatterns.push(mistake);
      }
    }

    if (paths.filter((p) => /service/i.test(p)).length >= 2 && /copy|duplicate|same logic/i.test(summary)) {
      duplicatedLogic.push('Multiple services may duplicate the same workflow');
    }

    const missingTests = !paths.some((p) => /test|spec/i.test(p)) && paths.length > 0;
    if (missingTests) issues.push('Missing tests for the change set');

    const architectureCompliance = Math.max(
      0,
      Math.min(1, 0.85 - brokenPatterns.length * 0.15 - (missingTests ? 0.1 : 0)),
    );

    return {
      planCompliance,
      architectureCompliance,
      issues,
      missingTests,
      duplicatedLogic,
      brokenPatterns,
      summary: `Plan compliance ${Math.round(planCompliance * 100)}%; architecture ${Math.round(architectureCompliance * 100)}%; issues=${issues.length}`,
    };
  }
}

export function createImplementationReviewer(): ImplementationReviewer {
  return new ImplementationReviewer();
}

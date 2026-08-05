import type { FixValidationResult, Incident } from '../types.js';

/**
 * Validate a proposed fix — never deploys; always requires human confirm.
 */
export class FixValidator {
  validate(input: {
    incident: Incident;
    changeSummary: string;
    changedPaths?: string[];
  }): FixValidationResult {
    const summary = input.changeSummary.toLowerCase();
    const paths = (input.changedPaths ?? []).map((p) => p.toLowerCase());
    const collateralRisk: string[] = [];

    const touchesAuth = paths.some((p) => /auth|jwt|session/.test(p)) || /token|jwt/.test(summary);
    const touchesDb = paths.some((p) => /migration|schema|prisma/.test(p));
    const mentionsFix =
      /fix|resolv|unif(y|ied)|centraliz|guard|null check|timeout|retry/.test(summary);

    if (touchesAuth) collateralRisk.push('Auth changes may affect login/session across modules');
    if (touchesDb) collateralRisk.push('Schema changes may break dependent services');
    if (paths.some((p) => /controller/.test(p)) && /prisma|sql|business/.test(summary)) {
      collateralRisk.push('Possible architecture drift: business logic in controller');
    }

    const architectureOk = !collateralRisk.some((r) => /architecture drift/.test(r));
    const fixedLikely =
      mentionsFix ||
      (input.incident.rootCause
        ? summary.includes(input.incident.rootCause.toLowerCase().slice(0, 12))
        : false);

    return {
      fixedLikely,
      architectureOk,
      collateralRisk,
      summary: fixedLikely
        ? `Fix looks plausible; ${collateralRisk.length} collateral risk note(s). Human must confirm.`
        : 'Insufficient evidence the change addresses the root cause. Human must confirm.',
      requiresHumanConfirm: true,
    };
  }
}

export function createFixValidator(): FixValidator {
  return new FixValidator();
}

import type {
  ArchitectureDiffResult,
  ArchitectureHealthScore,
  ArchitectureSnapshot,
  ComplexityFinding,
  CouplingFinding,
  RuleViolation,
} from '../types.js';
import { clampScore } from '../types.js';

export interface ScoreInput {
  coupling: CouplingFinding[];
  complexity: ComplexityFinding[];
  ruleViolations: RuleViolation[];
  /** 0–100 optional signals */
  testCoverage?: number;
  documentation?: number;
  security?: number;
  circularCount?: number;
  boundaryIssueCount?: number;
}

export class ArchitectureHealthScorer {
  score(input: ScoreInput): ArchitectureHealthScore {
    const highCoupling = input.coupling.filter((c) => c.highCoupling).length;
    const couplingScore = clampScore(100 - highCoupling * 8 - (input.circularCount ?? 0) * 15);

    const complexityPenalty =
      input.complexity.filter((c) => c.kind === 'large_file').length * 6 +
      input.complexity.filter((c) => c.kind === 'deep_nesting').length * 4 +
      input.complexity.filter((c) => c.kind === 'large_function').length * 3;
    const complexityScore = clampScore(100 - complexityPenalty);

    const testCoverage = clampScore(input.testCoverage ?? 70);
    const documentation = clampScore(
      (input.documentation ?? 75) - (input.boundaryIssueCount ?? 0) * 5,
    );
    const securityPenalty = input.ruleViolations.filter(
      (v) => v.ruleId === 'security-not-bypassed' || v.severity === 'critical',
    ).length;
    const security = clampScore((input.security ?? 80) - securityPenalty * 12);

    const rulePenalty = input.ruleViolations.length * 5;
    const overall = clampScore(
      couplingScore * 0.25 +
        complexityScore * 0.2 +
        testCoverage * 0.15 +
        documentation * 0.15 +
        security * 0.15 +
        clampScore(100 - rulePenalty) * 0.1,
    );

    const breakdown = [
      `coupling=${couplingScore}`,
      `complexity=${complexityScore}`,
      `tests=${testCoverage}`,
      `docs=${documentation}`,
      `security=${security}`,
    ];

    return {
      score: overall,
      coupling: couplingScore,
      complexity: complexityScore,
      testCoverage,
      documentation,
      security,
      breakdown,
    };
  }
}

export class ArchitectureDiff {
  compare(before: ArchitectureSnapshot, after: ArchitectureSnapshot, scores: {
    before: ArchitectureHealthScore;
    after: ArchitectureHealthScore;
  }): ArchitectureDiffResult {
    const scoreDelta = scores.after.score - scores.before.score;
    const regressions: string[] = [];
    const improvements: string[] = [];

    const beforeRisks = new Set(before.risks.map((r) => r.title));
    const afterRisks = new Set(after.risks.map((r) => r.title));

    for (const title of afterRisks) {
      if (!beforeRisks.has(title)) regressions.push(`New risk: ${title}`);
    }
    for (const title of beforeRisks) {
      if (!afterRisks.has(title)) improvements.push(`Resolved risk: ${title}`);
    }

    if (scoreDelta < -5) {
      regressions.push(`Architecture health dropped by ${Math.abs(scoreDelta)} points`);
    } else if (scoreDelta > 5) {
      improvements.push(`Architecture health improved by ${scoreDelta} points`);
    }

    const beforeCycles = before.dependencies.length;
    const afterCycles = after.dependencies.length;
    if (after.risks.filter((r) => /circular/i.test(r.title)).length >
      before.risks.filter((r) => /circular/i.test(r.title)).length) {
      regressions.push('Architecture regression: more circular dependency risks');
    }
    void beforeCycles;
    void afterCycles;

    return {
      beforeLabel: before.label,
      afterLabel: after.label,
      scoreDelta,
      regressions,
      improvements,
    };
  }
}

export function createArchitectureHealthScorer(): ArchitectureHealthScorer {
  return new ArchitectureHealthScorer();
}

export function createArchitectureDiff(): ArchitectureDiff {
  return new ArchitectureDiff();
}

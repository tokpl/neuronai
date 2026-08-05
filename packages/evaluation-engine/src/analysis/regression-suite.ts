import type { RegressionFinding } from '../types.js';
import { round2 } from '../types.js';

/**
 * AI Regression Suite — detect when quality worsens after changes.
 * No reinforcement learning — metric comparison only.
 */
export class AiRegressionSuite {
  compare(previous: Record<string, number>, current: Record<string, number>): RegressionFinding[] {
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    const findings: RegressionFinding[] = [];
    for (const metric of keys) {
      const prev = previous[metric] ?? 0;
      const curr = current[metric] ?? 0;
      const delta = round2(curr - prev);
      findings.push({
        metric,
        previous: round2(prev),
        current: round2(curr),
        delta,
        worse: delta < -0.05,
      });
    }
    return findings.sort((a, b) => a.delta - b.delta);
  }

  hasRegressions(findings: RegressionFinding[]): boolean {
    return findings.some((f) => f.worse);
  }
}

export function createAiRegressionSuite(): AiRegressionSuite {
  return new AiRegressionSuite();
}

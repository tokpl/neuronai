import type { BenchmarkMode, BenchmarkTask, QualityMetrics } from '../types.js';
import { clamp01, pct } from '../types.js';

export interface ContextEvalInput {
  mode: BenchmarkMode;
  task: BenchmarkTask;
  /** Retrieved / provided context text */
  contextText: string;
  tokenEstimate: number;
  /** Simulated whether the agent would succeed given context */
  simulatedSuccess?: boolean;
  /** Simulated regression risk 0-1 */
  simulatedRegression?: number;
}

/**
 * Quality metrics for memory-layer evaluation (no LLM required).
 */
export class MetricsCalculator {
  evaluate(input: ContextEvalInput): QualityMetrics & { tokenEstimate: number } {
    const hay = input.contextText.toLowerCase();
    const expectedHits = input.task.expectedFacts.filter((f) => hay.includes(f.toLowerCase()));
    const noiseHits = input.task.noiseFacts.filter((f) => hay.includes(f.toLowerCase()));
    const constraintHits = input.task.architectureConstraints.filter((c) =>
      c
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 3)
        .some((t) => hay.includes(t)),
    );

    const contextRecall = clamp01(expectedHits.length / Math.max(1, input.task.expectedFacts.length));
    const precisionDenom = expectedHits.length + noiseHits.length;
    const contextPrecision =
      precisionDenom === 0 ? (input.mode === 'WITH_NEURON' ? 0.85 : 0.4) : clamp01(expectedHits.length / precisionDenom);

    // Token efficiency: reward smaller contexts that still recall well
    const idealTokens = input.mode === 'WITH_NEURON' ? 3500 : 12_000;
    const tokenEfficiency = clamp01(
      (idealTokens / Math.max(input.tokenEstimate, 1)) * (0.5 + 0.5 * contextRecall),
    );

    const architectureCompliance = clamp01(
      constraintHits.length / Math.max(1, input.task.architectureConstraints.length),
    );

    const baseSuccess =
      input.simulatedSuccess ??
      (input.mode === 'WITH_NEURON'
        ? contextRecall >= 0.5 && architectureCompliance >= 0.4
        : contextRecall >= 0.25 && architectureCompliance >= 0.15);

    const taskSuccessRate = baseSuccess ? clamp01(0.55 + 0.45 * contextRecall) : clamp01(0.2 * contextRecall);

    const regressionRate =
      input.simulatedRegression ??
      clamp01(
        input.mode === 'WITH_NEURON'
          ? 0.35 * (1 - architectureCompliance) + 0.1 * (1 - contextPrecision)
          : 0.55 * (1 - architectureCompliance) + 0.2 * (1 - contextPrecision),
      );

    return {
      contextPrecision: pct(contextPrecision) / 100,
      contextRecall: pct(contextRecall) / 100,
      tokenEfficiency: pct(tokenEfficiency) / 100,
      taskSuccessRate: pct(taskSuccessRate) / 100,
      architectureCompliance: pct(architectureCompliance) / 100,
      regressionRate: pct(regressionRate) / 100,
      tokenEstimate: input.tokenEstimate,
    };
  }

  average(rows: QualityMetrics[]): QualityMetrics {
    if (!rows.length) {
      return {
        contextPrecision: 0,
        contextRecall: 0,
        tokenEfficiency: 0,
        taskSuccessRate: 0,
        architectureCompliance: 0,
        regressionRate: 0,
      };
    }
    const n = rows.length;
    const sum = rows.reduce(
      (a, r) => ({
        contextPrecision: a.contextPrecision + r.contextPrecision,
        contextRecall: a.contextRecall + r.contextRecall,
        tokenEfficiency: a.tokenEfficiency + r.tokenEfficiency,
        taskSuccessRate: a.taskSuccessRate + r.taskSuccessRate,
        architectureCompliance: a.architectureCompliance + r.architectureCompliance,
        regressionRate: a.regressionRate + r.regressionRate,
      }),
      {
        contextPrecision: 0,
        contextRecall: 0,
        tokenEfficiency: 0,
        taskSuccessRate: 0,
        architectureCompliance: 0,
        regressionRate: 0,
      },
    );
    return {
      contextPrecision: sum.contextPrecision / n,
      contextRecall: sum.contextRecall / n,
      tokenEfficiency: sum.tokenEfficiency / n,
      taskSuccessRate: sum.taskSuccessRate / n,
      architectureCompliance: sum.architectureCompliance / n,
      regressionRate: sum.regressionRate / n,
    };
  }
}

export function createMetricsCalculator(): MetricsCalculator {
  return new MetricsCalculator();
}

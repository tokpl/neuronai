import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  createBenchmarkRunner,
  type BenchmarkRunner,
  type BenchmarkRunnerOptions,
} from '../runner/runner.js';
import type { BenchmarkSuiteResult, EvaluationSnapshot, RetrievalBenchResult } from '../types.js';

export interface BenchmarkStatus {
  ready: boolean;
  lastRunAt: string | null;
  summary: Record<string, number | string> | null;
  historyTrend: {
    retrievalImproving: boolean | null;
    memoryQualityImproving: boolean | null;
    latest?: EvaluationSnapshot;
    previous?: EvaluationSnapshot;
  };
}

export class BenchmarkPlatform {
  private readonly runner: BenchmarkRunner = createBenchmarkRunner();
  private last: BenchmarkSuiteResult | null = null;

  async run(options: BenchmarkRunnerOptions = {}): Promise<BenchmarkSuiteResult> {
    this.last = await this.runner.run(options);
    return this.last;
  }

  async runRetrieval(options: BenchmarkRunnerOptions = {}): Promise<RetrievalBenchResult[]> {
    return this.runner.runRetrievalOnly(options);
  }

  status(): BenchmarkStatus {
    const trend = this.runner.getHistory().trend();
    if (!this.last) {
      return { ready: true, lastRunAt: null, summary: null, historyTrend: trend };
    }
    return {
      ready: true,
      lastRunAt: this.last.generatedAt,
      summary: {
        contextPrecision: this.last.metrics.contextPrecision,
        tokenReductionPct: this.last.comparison.tokenReductionPct,
        architectureLiftPct:
          Math.round(
            (this.last.comparison.withNeuron.architectureCompliance -
              this.last.comparison.withoutNeuron.architectureCompliance) *
              1000,
          ) / 10,
        memoryQualityAccuracy: this.last.memoryQuality.accuracy,
        overallScore: trend.latest?.overallScore ?? 0,
      },
      historyTrend: trend,
    };
  }

  async writeReport(cwd: string, result?: BenchmarkSuiteResult): Promise<string> {
    const report = result ?? this.last;
    if (!report) {
      throw new Error('No benchmark result yet — run neuron benchmark first');
    }
    const path = join(cwd, 'benchmark-report.md');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, report.markdown, 'utf8');
    return path;
  }
}

export function createBenchmarkPlatform(): BenchmarkPlatform {
  return new BenchmarkPlatform();
}

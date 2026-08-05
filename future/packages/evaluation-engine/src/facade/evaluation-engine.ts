import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createBenchmarkPlatform } from '@neuron-ai-memory/benchmark';

import {
  createHallucinationDetector,
  type HallucinationDetector,
} from '../analysis/hallucination-detector.js';
import { createDecisionQualityTracker } from '../analysis/decision-quality.js';
import { createImprovementAnalyzer } from '../analysis/improvement-analyzer.js';
import { createModelEvaluator } from '../analysis/model-evaluator.js';
import { createAiRegressionSuite } from '../analysis/regression-suite.js';
import { createNeuronBenchmarkSuite } from '../benchmarks/suite.js';
import { createFeedbackSystem } from '../feedback/feedback-system.js';
import { createAnswerScorer } from '../scoring/answer-scorer.js';
import {
  createMemoryQualityScorer,
  type MemoryQualityScorer,
} from '../scoring/memory-quality.js';
import { createNeuronRetrievalEvaluator } from '../scoring/retrieval-evaluator.js';
import type {
  EvaluationResult,
  EvaluationStoreDocument,
  FeedbackLabel,
  HallucinationContext,
  HallucinationReport,
  MemoryQualityScore,
  RetrievalEvalInput,
} from '../types.js';
import { nowIso, round2 } from '../types.js';

type MemoryQualityInput = Parameters<MemoryQualityScorer['score']>[0];

/**
 * Evaluation Engine facade — quality measurement + feedback + benchmarks.
 * Improves Neuron via metrics and configuration — never trains models / RL / user chats.
 */
export class EvaluationEngine {
  private readonly answers = createAnswerScorer();
  private readonly retrieval = createNeuronRetrievalEvaluator();
  private readonly hallucinations: HallucinationDetector = createHallucinationDetector();
  private readonly memoryQuality = createMemoryQualityScorer();
  private readonly feedback = createFeedbackSystem();
  private readonly benchmarks = createNeuronBenchmarkSuite();
  private readonly models = createModelEvaluator();
  private readonly regressions = createAiRegressionSuite();
  private readonly improvements = createImprovementAnalyzer();
  private readonly decisions = createDecisionQualityTracker();

  private evaluations: EvaluationResult[] = [];
  private memoryScores: MemoryQualityScore[] = [];
  private previousMetrics: Record<string, number> = {};
  private lastBenchmark: EvaluationStoreDocument['lastBenchmark'] = null;

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'evaluation.json'), 'utf8'),
      ) as EvaluationStoreDocument;
      this.evaluations = raw.recentEvaluations ?? [];
      this.feedback.load(raw.feedback ?? []);
      this.memoryScores = raw.memoryScores ?? [];
      this.models.load(raw.modelComparisons ?? []);
      this.lastBenchmark = raw.lastBenchmark ?? null;
      this.previousMetrics = {
        overall: raw.summary?.averageScore ?? 0,
        benchmark: raw.summary?.lastBenchmarkOverall ?? 0,
      };
    } catch {
      this.evaluations = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'evaluation.json');
    await writeFile(path, `${JSON.stringify(this.toDocument(), null, 2)}\n`, 'utf8');
    return path;
  }

  toDocument(): EvaluationStoreDocument {
    const avg = this.evaluations.length
      ? round2(
          this.evaluations.reduce((s, e) => s + e.score, 0) / this.evaluations.length,
        )
      : 0;
    return {
      version: 1,
      updatedAt: nowIso(),
      summary: {
        averageScore: avg,
        evaluationCount: this.evaluations.length,
        helpfulRate: round2(this.feedback.helpfulRate()),
        hallucinationWarnings: this.evaluations.filter((e) =>
          e.evidence.some((x) => /hallucination|unsupported|invented/i.test(x)),
        ).length,
        lastBenchmarkOverall: this.lastBenchmark?.overall ?? null,
      },
      recentEvaluations: this.evaluations.slice(0, 50),
      feedback: this.feedback.list(100),
      memoryScores: this.memoryScores.slice(0, 100),
      modelComparisons: this.models.list(),
      improvements: this.improvements.analyze({
        evaluations: this.evaluations,
        feedback: this.feedback.list(),
      }),
      regressions: this.regressions.compare(this.previousMetrics, {
        overall: avg,
        benchmark: this.lastBenchmark?.overall ?? avg,
      }),
      lastBenchmark: this.lastBenchmark,
    };
  }

  evaluateAnswer(input: {
    task: string;
    answer: string;
    expectedKeywords?: string[];
    unexpectedKeywords?: string[];
    evidenceSnippets?: string[];
    projectFacts?: string[];
    claimedConfidence?: number;
    hallucinationContext?: HallucinationContext;
  }): EvaluationResult & { hallucination?: HallucinationReport } {
    const result = this.answers.evaluate(input);
    let hallucination: HallucinationReport | undefined;
    if (input.hallucinationContext) {
      hallucination = this.hallucinations.detect(input.answer, input.hallucinationContext);
      if (!hallucination.ok) {
        result.evidence.push(`hallucination:${hallucination.summary}`);
        result.score = round2(result.score * 0.7);
        result.metrics.accuracy = round2(result.metrics.accuracy * 0.7);
        result.metrics.overall = result.score;
      }
    }
    this.evaluations.unshift(result);
    return { ...result, hallucination };
  }

  evaluateRetrieval(input: RetrievalEvalInput) {
    return this.retrieval.evaluate(input);
  }

  detectHallucinations(answer: string, ctx: HallucinationContext) {
    return this.hallucinations.detect(answer, ctx);
  }

  scoreMemories(inputs: MemoryQualityInput[]): MemoryQualityScore[] {
    this.memoryScores = this.memoryQuality.scoreMany(inputs);
    return this.memoryScores;
  }

  recordFeedback(input: {
    label: FeedbackLabel;
    note?: string;
    task?: string;
    evaluationId?: string;
  }) {
    return this.feedback.record(input);
  }

  async runBenchmark(neuronDir: string, answers?: Record<string, string>) {
    const run = await this.benchmarks.run({
      neuronDir,
      answers,
      includeBuiltin: true,
    });
    this.lastBenchmark = run;
    const findings = this.regressions.compare(this.previousMetrics, {
      overall: this.toDocument().summary.averageScore,
      benchmark: run.overall,
    });
    this.previousMetrics = {
      overall: this.toDocument().summary.averageScore,
      benchmark: run.overall,
    };
    const path = await this.save(neuronDir);
    return { run, regressions: findings, path };
  }

  recordModelScore(input: {
    provider: string;
    model: string;
    task: string;
    score: number;
    latencyMs?: number;
  }) {
    return this.models.record(input);
  }

  modelComparison(task: string) {
    return {
      rows: this.models.compare(task),
      markdown: this.models.markdown(task),
    };
  }

  recordDecisionQuality(input: {
    decisionId: string;
    recommended: string;
    actualChoice?: string;
    longTermResult?: 'good' | 'bad' | 'unknown';
  }) {
    return this.decisions.record(input);
  }

  qualityReport() {
    const doc = this.toDocument();
    return {
      summary: doc.summary,
      feedbackCounts: this.feedback.counts(),
      improvements: doc.improvements,
      regressions: doc.regressions,
      modelComparisons: doc.modelComparisons,
      decisionQualityAvg: this.decisions.averageScore(),
      recentEvaluations: doc.recentEvaluations.slice(0, 10),
      memoryTop: this.memoryScores.slice(0, 10),
      lastBenchmark: this.lastBenchmark,
      legacyBenchmark: createBenchmarkPlatform().status(),
      note: 'Metrics only — no full chats, prompts, or secrets stored.',
    };
  }
}

export function createEvaluationEngine(): EvaluationEngine {
  return new EvaluationEngine();
}

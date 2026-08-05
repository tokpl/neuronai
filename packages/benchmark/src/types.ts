import type { MemoryRecord, MemoryType } from '@neuron-ai-memory/types';

export type BenchmarkMode = 'WITHOUT_NEURON' | 'WITH_NEURON';

export type TaskKind = 'FEATURE' | 'BUGFIX' | 'REFACTOR' | 'ARCHITECTURE' | 'DEBUG';

export type ProjectKind = 'ecommerce' | 'saas' | 'game-server';

export interface BenchmarkTask {
  id: string;
  kind: TaskKind;
  prompt: string;
  /** Gold facts that should appear in good context */
  expectedFacts: string[];
  /** Distractor / noise keywords that hurt precision if over-included */
  noiseFacts: string[];
  architectureConstraints: string[];
}

export interface BenchmarkProject {
  id: ProjectKind;
  name: string;
  stack: string[];
  modules: string[];
  seedMemories: Array<{
    title: string;
    content: string;
    type: MemoryType;
    importanceScore?: number;
    tags?: string[];
  }>;
  /** Synthetic "raw dump" token estimate when dumping whole project */
  rawContextTokens: number;
}

export interface QualityMetrics {
  contextPrecision: number;
  contextRecall: number;
  tokenEfficiency: number;
  taskSuccessRate: number;
  architectureCompliance: number;
  regressionRate: number;
}

export interface ModeComparison {
  withoutNeuron: QualityMetrics & { tokenEstimate: number };
  withNeuron: QualityMetrics & { tokenEstimate: number };
  tokenReductionPct: number;
  informationPreservedPct: number;
}

export interface RetrievalBenchResult {
  memoryCount: number;
  latencyMs: number;
  tokenEstimate: number;
  rankingQuality: number;
  budget: number;
}

export interface MemoryQualitySample {
  title: string;
  content: string;
  label: 'good' | 'bad';
  reason: string;
}

export interface MemoryQualityResult {
  samples: number;
  accuracy: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface OnboardingBenchResult {
  withoutNeuronMinutes: number;
  withNeuronMinutes: number;
  speedupPct: number;
  factsCoveredWithout: number;
  factsCoveredWith: number;
}

export interface SimulatedAgentStep {
  task: string;
  mode: BenchmarkMode;
  retrievedTitles: string[];
  decision: string;
  evaluationNotes: string[];
}

export interface EvaluationSnapshot {
  at: string;
  overallScore: number;
  contextPrecision: number;
  tokenReductionPct: number;
  retrievalP50Ms: number;
  memoryQualityAccuracy: number;
}

export interface BenchmarkSuiteResult {
  generatedAt: string;
  projects: ProjectKind[];
  tasks: string[];
  comparison: ModeComparison;
  retrieval: RetrievalBenchResult[];
  memoryQuality: MemoryQualityResult;
  onboarding: OnboardingBenchResult;
  tokenOptimization: {
    beforeTokens: number;
    afterTokens: number;
    informationPreservedPct: number;
  };
  agentSimulation: SimulatedAgentStep[];
  metrics: QualityMetrics;
  markdown: string;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function pct(n: number): number {
  return Math.round(clamp01(n) * 1000) / 10;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function makeMemory(
  partial: Partial<MemoryRecord> & Pick<MemoryRecord, 'id' | 'title' | 'content' | 'type'>,
): MemoryRecord {
  return {
    projectId: 'bench',
    importanceScore: 0.8,
    confidenceScore: 0.85,
    freshnessScore: 0.9,
    source: 'manual',
    status: 'active',
    version: 1,
    tags: [],
    usageCount: 1,
    lastUsedAt: nowIso(),
    embeddingId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...partial,
  };
}

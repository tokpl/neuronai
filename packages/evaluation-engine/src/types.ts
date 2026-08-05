/** Evaluation Engine domain — measure quality; never train models or collect private chats. */

export type FeedbackLabel =
  | 'Helpful'
  | 'Wrong'
  | 'Missing context'
  | 'Needs improvement';

export type BenchmarkCategory =
  | 'architecture'
  | 'debug'
  | 'security'
  | 'performance'
  | 'documentation';

export interface QualityMetrics {
  accuracy: number;
  relevance: number;
  completeness: number;
  confidence: number;
  consistency: number;
  /** Aggregate 0–1 */
  overall: number;
}

export interface EvaluationCriterion {
  name: string;
  score: number;
  note?: string;
}

export interface EvaluationResult {
  id: string;
  task: string;
  /** Redacted / truncated — never full user prompts with secrets */
  input: string;
  /** Redacted / truncated answer excerpt */
  output: string;
  score: number;
  criteria: EvaluationCriterion[];
  evidence: string[];
  metrics: QualityMetrics;
  timestamp: string;
}

export interface RetrievalEvalInput {
  query: string;
  retrievedTitles: string[];
  retrievedIds?: string[];
  expectedTitles?: string[];
  expectedIds?: string[];
}

export interface RetrievalEvalResult {
  precision: number;
  recall: number;
  rankingQuality: number;
  score: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  evidence: string[];
}

export interface MemoryQualityScore {
  memoryId: string;
  title: string;
  confidence: number;
  usageFrequency: number;
  validationCount: number;
  freshness: number;
  overall: number;
}

export interface HallucinationFinding {
  claim: string;
  kind: 'unsupported_claim' | 'missing_evidence' | 'invented_file' | 'unknown_decision';
  severity: 'low' | 'medium' | 'high';
  evidence: string;
}

export interface HallucinationContext {
  /** Known stack / modules / decisions from the project brain */
  knownFacts: string[];
  /** Known file paths */
  knownFiles?: string[];
  /** Known decision titles */
  knownDecisions?: string[];
}

export interface HallucinationReport {
  ok: boolean;
  findings: HallucinationFinding[];
  summary: string;
}

export interface FeedbackEntry {
  id: string;
  label: FeedbackLabel;
  /** Technical note only — no emotions / PII */
  note?: string;
  task?: string;
  evaluationId?: string;
  at: string;
}

export interface BenchmarkCase {
  id: string;
  category: BenchmarkCategory;
  question: string;
  expectedKeywords: string[];
  unexpectedKeywords?: string[];
  goldMemoryTitles?: string[];
}

export interface BenchmarkCaseResult {
  caseId: string;
  category: BenchmarkCategory;
  score: number;
  passed: boolean;
  details: string;
}

export interface BenchmarkRunResult {
  id: string;
  source: 'builtin' | 'project';
  cases: BenchmarkCaseResult[];
  overall: number;
  at: string;
}

export interface ModelEvalRow {
  provider: string;
  model: string;
  task: string;
  score: number;
  latencyMs?: number;
  samples: number;
}

export interface RegressionFinding {
  metric: string;
  previous: number;
  current: number;
  delta: number;
  worse: boolean;
}

export interface ImprovementSuggestion {
  problem: string;
  suggestion: string;
  area: 'retrieval' | 'memory' | 'routing' | 'decisions' | 'benchmarks';
  priority: 'low' | 'medium' | 'high';
}

export interface DecisionQualityRecord {
  decisionId: string;
  recommended: string;
  actualChoice?: string;
  longTermResult?: 'good' | 'bad' | 'unknown';
  score: number;
}

export interface EvaluationStoreDocument {
  version: 1;
  updatedAt: string;
  /** Dashboard metrics only — no full conversations */
  summary: {
    averageScore: number;
    evaluationCount: number;
    helpfulRate: number;
    hallucinationWarnings: number;
    lastBenchmarkOverall: number | null;
  };
  recentEvaluations: EvaluationResult[];
  feedback: FeedbackEntry[];
  memoryScores: MemoryQualityScore[];
  modelComparisons: ModelEvalRow[];
  improvements: ImprovementSuggestion[];
  regressions: RegressionFinding[];
  lastBenchmark: BenchmarkRunResult | null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

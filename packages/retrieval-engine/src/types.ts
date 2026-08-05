import type { MemoryRecord } from '@neuron-ai-memory/types';

export type AgentMode = 'fast' | 'standard' | 'architect' | 'debug' | 'refactor';

export type TaskIntent =
  | 'FEATURE'
  | 'BUGFIX'
  | 'REFACTOR'
  | 'ARCHITECTURE'
  | 'DEBUG'
  | 'DOCS'
  | 'UNKNOWN';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AnalyzedQuery {
  raw: string;
  intent: TaskIntent;
  domains: string[];
  related: string[];
  keywords: string[];
  risk: RiskLevel;
  complexity: 'small' | 'standard' | 'large' | 'architecture';
}

export type RetrievalSource =
  | 'memory'
  | 'knowledge_graph'
  | 'code'
  | 'decision'
  | 'constitution'
  | 'git'
  | 'documentation'
  | 'style';

export interface RetrievalHit {
  id: string;
  source: RetrievalSource;
  title: string;
  content: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Optional pre-scores from source */
  baseRelevance?: number;
  importance?: number;
  confidence?: number;
  freshness?: number;
  metadata?: Record<string, unknown>;
}

export interface RankedHit extends RetrievalHit {
  relevanceScore: number;
  importanceScore: number;
  confidenceScore: number;
  distanceScore: number;
  freshnessScore: number;
  finalScore: number;
}

export interface RankingWeights {
  relevance: number;
  importance: number;
  confidence: number;
  distance: number;
  freshness: number;
  taskRelevance: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  relevance: 0.28,
  importance: 0.2,
  confidence: 0.12,
  distance: 0.1,
  freshness: 0.12,
  taskRelevance: 0.18,
};

export interface ContextConflict {
  topic: string;
  older: { title: string; content: string; at?: string };
  newer: { title: string; content: string; at?: string };
  message: string;
}

export interface AssembledContext {
  architecture: string[];
  importantDecisions: string[];
  relatedFiles: string[];
  warnings: string[];
  existingPatterns: string[];
  suggestedApproach: string[];
  conflicts: ContextConflict[];
  clusters: Array<{ name: string; items: string[] }>;
  markdown: string;
  tokenEstimate: number;
  selected: RankedHit[];
  omitted: number;
  explanation: string[];
}

export interface RetrievalInput {
  task: string;
  memories: MemoryRecord[];
  /** Active constitution rule texts */
  constitutionRules?: string[];
  /** File / symbol names for code + style */
  fileNames?: string[];
  /** Optional graph module names */
  graphModules?: string[];
  /** Optional git log subject lines */
  gitSubjects?: string[];
  /** Optional doc snippets */
  docSnippets?: Array<{ title: string; content: string }>;
  agentMode?: AgentMode;
  availableTokens?: number;
  rankingWeights?: Partial<RankingWeights>;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

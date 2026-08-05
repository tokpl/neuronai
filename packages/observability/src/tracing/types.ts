/** Internal Neuron observability - not a cloud analytics platform. */

export type TraceRetentionMode = 'disable' | 'temporary' | 'persistent';

export type OperationKind =
  | 'retrieve'
  | 'reason'
  | 'generate'
  | 'scan'
  | 'decide'
  | 'explain'
  | 'other';

export interface NeuronTrace {
  id: string;
  operation: string;
  operationKind: OperationKind;
  timestamp: string;
  durationMs: number;
  inputType: string;
  contextSources: string[];
  modelUsed?: string;
  outputType: string;
  confidence?: number;
  /** Redacted summaries only */
  summary: string;
}

export interface ReasoningStep {
  stage:
    | 'user_request'
    | 'context_retrieval'
    | 'selected_memories'
    | 'graph_traversal'
    | 'rules_applied'
    | 'model_generation'
    | 'final_response';
  detail: string;
  refs?: string[];
}

export interface ReasoningTrace {
  id: string;
  neuronTraceId: string;
  steps: ReasoningStep[];
  finalConfidence?: number;
}

export interface MemoryUsageTrace {
  id: string;
  neuronTraceId: string;
  memories: Array<{
    title: string;
    confidence: number;
    reason: string;
  }>;
}

export interface AIModelTrace {
  id: string;
  neuronTraceId: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  costEstimate: number;
  success: boolean;
}

export interface RetrievalDebugSnapshot {
  query: string;
  candidateCount: number;
  selectedCount: number;
  ranking: Array<{ title: string; score: number }>;
  selected: string[];
}

export interface DecisionDebugSnapshot {
  recommendation: string;
  evidence: string[];
  confidence: number;
  modules?: number;
}

export interface NeuronMetricsSnapshot {
  scanTimeMs: number;
  retrievalLatencyMs: number;
  graphQueryMs: number;
  memorySize: number;
  modelLatencyMs: number;
  counters: Record<string, number>;
  at: string;
}

export interface AnalyzedError {
  category: string;
  rootCause: string;
  affectedModule: string;
  solution: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TraceRetentionPolicy {
  mode: TraceRetentionMode;
  /** Max traces kept when temporary/persistent */
  maxTraces: number;
  /** Hours for temporary retention (ignored if disable/persistent) */
  temporaryHours: number;
}

export interface ObservabilityStoreDocument {
  version: 1;
  debugMode: boolean;
  retention: TraceRetentionPolicy;
  traces: NeuronTrace[];
  reasoning: ReasoningTrace[];
  memoryUsage: MemoryUsageTrace[];
  modelTraces: AIModelTrace[];
  metrics: NeuronMetricsSnapshot[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_RETENTION: TraceRetentionPolicy = {
  mode: 'temporary',
  maxTraces: 50,
  temporaryHours: 24,
};

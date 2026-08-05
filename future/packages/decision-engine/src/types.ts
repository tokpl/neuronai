export type NeuronDecisionType =
  | 'RECOMMENDATION'
  | 'WARNING'
  | 'CONFLICT'
  | 'ALTERNATIVE'
  | 'ACTION_PLAN';

export type FeedbackLabel = 'HELPFUL' | 'WRONG' | 'PARTIALLY_CORRECT';

export interface EvidenceItem {
  kind: 'memory' | 'code' | 'decision' | 'incident' | 'rule' | 'graph' | 'pattern';
  ref: string;
  detail: string;
  weight: number;
}

export interface NeuronDecision {
  id: string;
  type: NeuronDecisionType;
  context: string;
  /** Human-readable recommendation / warning text */
  conclusion: string;
  reasoning: string[];
  confidence: number;
  evidence: EvidenceItem[];
  impact: string;
  alternatives?: Array<{ option: string; tradeoffs: string; score: number }>;
  createdAt: string;
}

export interface DecisionTrace {
  input: string;
  context: string[];
  evidence: EvidenceItem[];
  conclusion: string;
  confidence: number;
  steps: string[];
}

export interface DecisionFeedback {
  id: string;
  decisionId: string;
  label: FeedbackLabel;
  note?: string;
  createdAt: string;
}

export interface ReasoningContext {
  request: string;
  memories?: string[];
  decisions?: string[];
  incidents?: string[];
  rules?: string[];
  codeRefs?: string[];
  graphSummary?: string;
  patterns?: string[];
}

export interface OptionPair {
  a: { name: string; notes?: string };
  b: { name: string; notes?: string };
  topic?: string;
}

export interface DecisionStoreDocument {
  version: 1;
  decisions: NeuronDecision[];
  feedback: DecisionFeedback[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

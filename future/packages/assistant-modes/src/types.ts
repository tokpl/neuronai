/** Assistant modes — help the developer; no autonomous multi-agent orchestration. */

export type ModeId =
  | 'architect'
  | 'code_review'
  | 'debug'
  | 'security_review'
  | 'performance'
  | 'documentation'
  | 'onboarding'
  | 'refactoring';

export type ContextNeed =
  | 'files'
  | 'dependencies'
  | 'security_rules'
  | 'git_diff'
  | 'logs'
  | 'incidents'
  | 'architecture'
  | 'knowledge_graph'
  | 'decisions'
  | 'performance_signals'
  | 'docs'
  | 'team_memory'
  | 'technical_debt';

export interface PriorityRule {
  id: string;
  description: string;
  weight: number;
}

export interface NeuronMode {
  id: ModeId;
  name: string;
  description: string;
  enabledCapabilities: string[];
  priorityRules: PriorityRule[];
  outputFormat: string[];
  requiredContext: ContextNeed[];
  suggestedMcpTools: string[];
  cursorCommand: string;
}

export interface ModeOutput {
  modeId: ModeId;
  summary: string;
  evidence: string[];
  findings: string[];
  recommendations: string[];
  confidence: number;
  analysisFocus: string[];
  suggestedTools: string[];
}

export interface ModeUsageRecord {
  id: string;
  modeId: ModeId;
  query: string;
  at: string;
  useful?: boolean;
  feedback?: string;
  accuracyHint?: number;
}

export interface ModeEvaluationSnapshot {
  modeId: ModeId;
  runs: number;
  usefulCount: number;
  usefulnessRate: number;
  avgAccuracyHint: number;
  developerFeedback: string[];
}

export interface AssistantModesStoreDocument {
  version: 1;
  usage: ModeUsageRecord[];
  updatedAt: string;
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

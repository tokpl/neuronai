/** Git as a history source — not a git hosting product. */

export type ChangeType =
  | 'FEATURE'
  | 'BUGFIX'
  | 'REFACTOR'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'ARCHITECTURE'
  | 'DOCUMENTATION';

export interface GitChangeMemory {
  id: string;
  /** Short commit hash / id — never full patch dump */
  commit: string;
  /** Display name only — not for blame/scoring */
  author: string;
  date: string;
  filesChanged: string[];
  modulesAffected: string[];
  changeType: ChangeType;
  relatedDecisions: string[];
  relatedIncidents: string[];
  relatedDocs: string[];
  impact: 'low' | 'medium' | 'high';
  messageSummary: string;
  /** Sanitized one-liner about effect */
  effect?: string;
}

export interface ArchitectureTransition {
  id: string;
  before: string;
  after: string;
  commit?: string;
  date: string;
  relatedDecisions: string[];
  memoryTitle: string;
  summary: string;
}

export interface RegressionMatch {
  newChangeId: string;
  priorChangeId: string;
  similarity: number;
  reason: string;
  priorProblemHint?: string;
  risk: 'low' | 'medium' | 'high';
}

export interface KnowledgeOrigin {
  topic: string;
  introducedInCommit?: string;
  relatedDecision?: string;
  relatedFiles: string[];
  note: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: 'commit' | 'decision' | 'incident' | 'architecture';
  title: string;
  refs: string[];
}

export interface EngineeringTimeline {
  events: TimelineEvent[];
  note: string;
}

export interface GitIntelligenceStoreDocument {
  version: 1;
  changes: GitChangeMemory[];
  transitions: ArchitectureTransition[];
  updatedAt: string;
}

export interface CommitAnalyzeInput {
  commit: string;
  author?: string;
  date?: string;
  message: string;
  /** May contain secrets — will be sanitized; not stored in full */
  diff?: string;
  filesChanged?: string[];
  relatedDecisions?: string[];
  relatedIncidents?: string[];
  relatedDocs?: string[];
  knownProblemCommits?: Array<{ commit: string; problem: string; files?: string[] }>;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

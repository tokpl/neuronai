export type ProjectEventType =
  | 'FILE_CREATED'
  | 'FILE_CHANGED'
  | 'FILE_DELETED'
  | 'DEPENDENCY_CHANGED'
  | 'GIT_COMMIT'
  | 'BRANCH_CHANGED'
  | 'ARCHITECTURE_CHANGED';

export type ChangeImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ProjectEvent {
  id: string;
  type: ProjectEventType;
  at: string;
  path?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface FileChangeInsight {
  path: string;
  summary: string;
  why: string;
  affected: string[];
  importance: ChangeImportance;
  moduleHints: string[];
}

export interface GitCommitInsight {
  message: string;
  changedModules: string[];
  related: string[];
  suggestion?: string;
  importance: ChangeImportance;
}

export interface ArchitectureDriftFinding {
  id: string;
  rule: string;
  evidence: string;
  path: string;
  severity: 'warning' | 'high';
  message: string;
}

export interface MemorySuggestion {
  id: string;
  kind: 'new_decision' | 'new_pattern' | 'update' | 'cursor_rule';
  title: string;
  content: string;
  confidence: number;
  sourceEventId?: string;
  requiresApproval: true;
}

export interface TimelineEntry {
  id: string;
  at: string;
  kind: 'architecture' | 'decision' | 'migration' | 'feature' | 'drift';
  title: string;
  detail: string;
}

export interface LiveProjectHealth {
  score: number;
  openDrift: number;
  pendingMemories: number;
  recentHighChanges: number;
  summary: string;
  generatedAt: string;
}

export interface ContinuousState {
  version: 1;
  projectRoot: string;
  events: ProjectEvent[];
  insights: FileChangeInsight[];
  gitInsights: GitCommitInsight[];
  drift: ArchitectureDriftFinding[];
  pendingMemories: MemorySuggestion[];
  timeline: TimelineEntry[];
  cursorRuleSuggestions: MemorySuggestion[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

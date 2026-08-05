export type TaskStatus = 'PLANNED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'ABANDONED';

export interface DeveloperSession {
  id: string;
  project: string;
  startTime: string;
  endTime: string | null;
  activeArea: string;
  relatedFiles: string[];
  relatedTasks: string[];
  decisions: string[];
  unfinishedWork: string[];
  summary: string | null;
  branch?: string;
  commits?: string[];
  status: 'active' | 'paused' | 'closed';
}

export interface TechnicalTaskMemory {
  id: string;
  title: string;
  status: TaskStatus;
  /** 0–100 technical completion estimate — not people productivity */
  percentComplete: number;
  completed: string[];
  remaining: string[];
  relatedDecisions: string[];
  relatedFiles: string[];
  risks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FocusContext {
  area: string;
  allowedModules: string[];
  relatedFiles: string[];
  excludedHint: string;
}

export interface InterruptionRecord {
  id: string;
  whyStarted: string;
  whatChanged: string[];
  whatRemainsRisky: string[];
  activeArea: string;
  pausedAt: string;
}

export interface ResumePacket {
  lastWorkSummary: string;
  changedFiles: string[];
  pendingDecisions: string[];
  nextSuggestedSteps: string[];
  activeSession: DeveloperSession | null;
  focus: FocusContext | null;
  interruption: InterruptionRecord | null;
  branch?: string;
  note: string;
}

export interface HandoffDocument {
  currentState: string;
  completed: string[];
  pending: string[];
  risks: string[];
  importantDecisions: string[];
  relatedFiles: string[];
  branch?: string;
  markdown: string;
}

export interface TaskPlanStep {
  order: number;
  title: string;
  detail: string;
  risk?: string;
}

export interface TaskPlan {
  feature: string;
  steps: TaskPlanStep[];
  architectureNotes: string[];
  dependencies: string[];
  risks: string[];
}

export interface ProjectFlowMetrics {
  unfinishedTechnicalAreas: string[];
  blockedAreas: string[];
  frequentChangeAreas: string[];
  note: string;
}

export interface WorkflowStoreDocument {
  version: 1;
  sessions: DeveloperSession[];
  tasks: TechnicalTaskMemory[];
  focus: FocusContext | null;
  interruptions: InterruptionRecord[];
  updatedAt: string;
}

/** Privacy: never persist these categories */
export const FORBIDDEN_CONTEXT = [
  'private conversations',
  'non-project activity',
  'personal data',
  'employee monitoring',
  'time tracking of people',
] as const;

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

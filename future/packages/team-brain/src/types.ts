/** Team Brain domain — technical knowledge sharing (no social network / chat / profiles). */

export type KnowledgePermissionLevel =
  | 'VIEW'
  | 'COMMENT'
  | 'SUGGEST'
  | 'APPROVE'
  | 'ADMIN';

export type SharedMemoryType =
  | 'ARCHITECTURE_DECISION'
  | 'PROJECT_RULE'
  | 'INCIDENT'
  | 'PATTERN'
  | 'DOCUMENTATION'
  | 'SECURITY_RULE';

export type ApprovalStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';

export type Visibility = 'personal' | 'project' | 'team';

export type SyncMode = 'local_only' | 'self_hosted' | 'cloud_future';

export interface TeamMember {
  id: string;
  displayName: string;
  permission: KnowledgePermissionLevel;
  joinedAt: string;
}

export interface MemoryOwnership {
  creator: string;
  contributors: string[];
  /** e.g. "Cursor session", "manual", "import" */
  source: string;
  approvedBy?: string | null;
}

export interface SharedMemoryHistoryEntry {
  at: string;
  actorId: string;
  action: string;
  detail?: string;
}

export interface SharedMemory {
  id: string;
  type: SharedMemoryType;
  title: string;
  content: string;
  owner: string;
  contributors: string[];
  visibility: Visibility;
  confidence: number;
  status: ApprovalStatus;
  ownership: MemoryOwnership;
  history: SharedMemoryHistoryEntry[];
  projectId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamBrainModel {
  id: string;
  name: string;
  projects: string[];
  members: TeamMember[];
  sharedKnowledge: SharedMemory[];
  permissions: KnowledgePermissionLevel[];
  createdAt: string;
}

export interface KnowledgeConflict {
  id: string;
  topic: string;
  optionA: { title: string; content: string; author: string };
  optionB: { title: string; content: string; author: string };
  arguments: string[];
  history: string[];
  currentStandard: string | null;
  recommendation: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: 'decision' | 'architecture' | 'incident' | 'migration' | 'rule' | 'approval';
  title: string;
  actorId?: string;
  status?: string;
}

export interface OnboardingBundle {
  projectIntroduction: string;
  architectureOverview: string[];
  importantDecisions: string[];
  commonMistakes: string[];
  securityRules: string[];
  markdown: string;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  action: 'Memory created' | 'Memory changed' | 'Memory approved' | 'Memory archived' | string;
  memoryId: string;
  actorId: string;
  detail?: string;
}

export interface TeamBrainDocument {
  version: 1;
  brain: TeamBrainModel;
  audit: AuditLogEntry[];
  syncMode: SyncMode;
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const PERMISSION_RANK: Record<KnowledgePermissionLevel, number> = {
  VIEW: 1,
  COMMENT: 2,
  SUGGEST: 3,
  APPROVE: 4,
  ADMIN: 5,
};

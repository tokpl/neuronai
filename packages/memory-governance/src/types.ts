import type { MemoryRecord } from '@neuron-ai-memory/types';

/**
 * Memory lifecycle (governance) — orthogonal to store MemoryStatus.
 * Neuron never permanently deletes; ARCHIVED keeps history.
 */
export type MemoryLifecycleState =
  | 'PROPOSED'
  | 'ACTIVE'
  | 'VALIDATED'
  | 'OUTDATED'
  | 'CONFLICTED'
  | 'ARCHIVED';

export type ReviewPriority = 'low' | 'medium' | 'high' | 'critical';

export type CleanupAction =
  | 'merge'
  | 'supersede'
  | 'archive'
  | 'invalidate'
  | 'recalculate'
  | 'review'
  | 'keep';

export type MaintenanceCadence = 'daily' | 'weekly' | 'manual';

export interface MemoryHealthScore {
  memoryId: string;
  accuracyScore: number;
  usageScore: number;
  freshnessScore: number;
  confidenceScore: number;
  relationshipScore: number;
  /** 0–100 */
  healthScore: number;
  lifecycle: MemoryLifecycleState;
  importance: number;
  whyImportant: string;
  whyReviewOrRemove?: string;
}

export interface DecayAdjustment {
  memoryId: string;
  previousConfidence: number;
  nextConfidence: number;
  previousImportance: number;
  nextImportance: number;
  priority: ReviewPriority;
  reasons: string[];
  /** Never deletes — only adjusts scores */
  destructive: false;
}

export interface ImportanceBreakdown {
  memoryId: string;
  frequency: number;
  connections: number;
  businessImpact: number;
  recentUsage: number;
  developerValidation: number;
  /** 0–1 */
  importance: number;
}

export interface StaleSignal {
  memoryId: string;
  reason: string;
  evidence: string[];
  priority: ReviewPriority;
}

export interface ConflictResolutionSuggestion {
  topic: string;
  olderId: string;
  newerId: string;
  olderTitle: string;
  newerTitle: string;
  resolution: string;
  suggestedAction: 'supersede';
  why: string;
  /** Never auto-applied */
  requiresApproval: true;
}

export interface DuplicateSuggestion {
  leftId: string;
  rightId: string;
  leftTitle: string;
  rightTitle: string;
  similarity: number;
  suggestedAction: 'merge';
  mergeHint: string;
  why: string;
  requiresApproval: true;
}

export interface ValidationResult {
  memoryId: string;
  valid: boolean;
  sources: Array<'code' | 'developer' | 'tests' | 'git' | 'heuristic'>;
  evidence: string[];
  lifecycleHint?: MemoryLifecycleState;
}

export interface ArchiveProposal {
  memoryId: string;
  title: string;
  reason: string;
  fromLifecycle: MemoryLifecycleState;
  toLifecycle: 'ARCHIVED';
  requiresApproval: true;
}

export interface CleanupOperation {
  id: string;
  action: CleanupAction;
  memoryIds: string[];
  detail: string;
  requiresApproval: true;
  /** Permanent delete is never produced */
  permanentDelete: false;
}

export interface ReviewQueueItem {
  memoryId: string;
  title: string;
  reason: string;
  priority: ReviewPriority;
  suggestedAction: CleanupAction;
  why: string;
  policyId?: string;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  match: {
    types?: MemoryRecord['type'][];
    tagsAny?: string[];
    titleIncludes?: string[];
  };
  reviewEveryDays: number | null;
  neverAutoArchive: boolean;
  whySuggested: string;
}

export interface CleanupSuggestion {
  id: string;
  kind: 'stale' | 'conflict' | 'duplicate' | 'policy' | 'low_quality';
  memoryIds: string[];
  action: CleanupAction;
  title: string;
  detail: string;
  why: string;
  priority: ReviewPriority;
  requiresApproval: true;
}

export interface GovernanceAuditEntry {
  id: string;
  at: string;
  action: string;
  memoryIds: string[];
  detail: string;
  actor: string;
}

export interface MaintenanceConfig {
  /** Default OFF — no automatic scheduled runs */
  enabled: boolean;
  cadence: MaintenanceCadence;
}

export interface BrainHealthReport {
  overallScore: number;
  memoryCount: number;
  healthyCount: number;
  totals: {
    total: number;
    active: number;
    archived: number;
    conflicts: number;
    outdated: number;
    proposed: number;
  };
  problems: {
    outdated: number;
    conflicts: number;
    duplicates: number;
    lowQuality: number;
    unusedRules: number;
  };
  recommendations: string[];
  scores: MemoryHealthScore[];
  reviewQueue: ReviewQueueItem[];
  cleanupSuggestions: CleanupSuggestion[];
  decayAdjustments: DecayAdjustment[];
  markdown: string;
  generatedAt: string;
}

export interface GovernanceScanInput {
  memories: MemoryRecord[];
  codeSignals?: string[];
  rules?: string[];
  now?: Date;
  /** Optional git/test signals for validation */
  validationSignals?: {
    testMentions?: string[];
    gitSubjects?: string[];
  };
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function nowIso(d = new Date()): string {
  return d.toISOString();
}

export function daysSince(iso: string | null | undefined, now: Date): number {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 9999;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

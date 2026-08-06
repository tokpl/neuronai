export type MemoryType =
  | 'architecture_decision'
  | 'knowledge'
  | 'pattern'
  | 'mistake'
  | 'context'
  | 'business_rule'
  | 'dependency';

export type MemoryStatus = 'active' | 'archived' | 'superseded';

export type MemorySource = 'agent' | 'user' | 'git' | 'documentation' | 'manual';

export type RelationType =
  'depends_on' | 'related_to' | 'replaces' | 'conflicts_with' | 'derived_from';

/** Team / personal / org visibility (team-memory architecture). */
export type MemoryScope = 'PERSONAL' | 'PROJECT' | 'TEAM' | 'ORGANIZATION';

/** Serializable memory DTO used across packages. */
export interface MemoryRecord {
  id: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  importanceScore: number;
  confidenceScore: number;
  freshnessScore: number;
  source: MemorySource;
  status: MemoryStatus;
  version: number;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  /** Reserved for future pgvector linkage */
  embeddingId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Optional team-memory scope (defaults to PROJECT when unset) */
  scope?: MemoryScope;
  /** Optional local actor / future user id */
  ownerId?: string | null;
  /**
   * Repo-relative paths this memory was derived from (scan-grounded knowledge).
   * User-authored memories leave this empty; scan invalidation uses it.
   */
  paths?: string[];
}

export interface MemoryVersionRecord {
  id: string;
  memoryId: string;
  version: number;
  title: string;
  content: string;
  reason: string;
  createdAt: string;
  createdBy: MemorySource;
}

export interface MemoryRelationRecord {
  id: string;
  projectId: string;
  fromMemoryId: string;
  toMemoryId: string;
  relationType: RelationType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  type: string;
  stack: string[];
  createdAt: string;
  updatedAt: string;
}

export type StoreOutcomeStatus = 'stored' | 'duplicate' | 'rejected' | 'needs_review';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptimeMs: number;
  mode: 'local' | 'cloud';
}

/**
 * Team Memory domain types — local-first shared engineering knowledge.
 * No cloud auth / billing; identities are local actors for architecture readiness.
 */

export type MemoryScope = 'PERSONAL' | 'PROJECT' | 'TEAM' | 'ORGANIZATION';

export type PermissionAction = 'read' | 'write' | 'approve' | 'archive';

/** Future-facing roles (enforced locally today; cloud IdP later). */
export type TeamRole = 'owner' | 'reviewer' | 'contributor' | 'viewer';

export type DecisionReviewStatus =
  | 'draft'
  | 'proposed'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'archived';

export type AuditAction = 'create' | 'update' | 'approve' | 'reject' | 'archive' | 'read';

export type TeamGraphNodeType = 'DEVELOPER' | 'TEAM' | 'PROJECT' | 'MEMORY' | 'ORGANIZATION';

export type TeamGraphRelation =
  | 'CREATED_BY'
  | 'APPROVED_BY'
  | 'USED_BY'
  | 'MEMBER_OF'
  | 'OWNS';

export interface LocalActor {
  id: string;
  displayName: string;
  role: TeamRole;
  teamId: string;
  /** Optional org placeholder for ORGANIZATION scope readiness */
  organizationId?: string;
}

export interface MemoryPermission {
  scope: MemoryScope;
  action: PermissionAction;
  /** Who may perform the action */
  roles: TeamRole[];
  /** PERSONAL: only owner; PROJECT+: role matrix */
  ownerOnly?: boolean;
}

export interface ScopedMemoryRecord {
  id: string;
  /** Optional link into Memory Engine id */
  memoryId: string | null;
  projectId: string;
  teamId: string;
  organizationId?: string;
  scope: MemoryScope;
  title: string;
  content: string;
  type: string;
  status: DecisionReviewStatus;
  ownerId: string;
  createdBy: string;
  updatedBy: string;
  approvedBy: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeContribution {
  id: string;
  memoryId: string;
  projectId: string;
  createdBy: string;
  updatedBy: string;
  approvedBy: string | null;
  scope: MemoryScope;
  action: 'created' | 'updated' | 'approved' | 'archived';
  at: string;
}

export interface MemoryAuditEntry {
  id: string;
  memoryId: string;
  projectId: string;
  actorId: string;
  action: AuditAction;
  scope: MemoryScope;
  detail?: string;
  at: string;
}

export interface TeamGraphNode {
  id: string;
  type: TeamGraphNodeType;
  name: string;
  projectId?: string;
  teamId?: string;
  metadata: Record<string, unknown>;
}

export interface TeamGraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: TeamGraphRelation;
  metadata: Record<string, unknown>;
}

export interface TeamDocument {
  version: 1;
  projectId: string;
  teamId: string;
  teamName: string;
  actors: LocalActor[];
  memories: ScopedMemoryRecord[];
  contributions: KnowledgeContribution[];
  audit: MemoryAuditEntry[];
  graph: { nodes: TeamGraphNode[]; edges: TeamGraphEdge[] };
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

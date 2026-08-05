import { createMemoryAuditLog } from '../audit/audit-log.js';
import { createContributionTracker } from '../contribution/tracker.js';
import { createTeamKnowledgeGraph } from '../graph/team-graph.js';
import { createPermissionGate, isSharedScope } from '../permissions/gate.js';
import type {
  DecisionReviewStatus,
  LocalActor,
  MemoryScope,
  ScopedMemoryRecord,
  TeamDocument,
} from '../types.js';
import { newId, nowIso } from '../types.js';
import { defaultScopeForDecision } from '../scope/scopes.js';

/**
 * Decision review flow:
 * Developer proposes → pending_review → Reviewer approves → active (official).
 * PERSONAL scopes auto-activate (private notes).
 */
export class DecisionReviewWorkflow {
  private readonly gate = createPermissionGate();
  private readonly audit = createMemoryAuditLog();
  private readonly contrib = createContributionTracker();
  private readonly graph = createTeamKnowledgeGraph();

  propose(
    doc: TeamDocument,
    actor: LocalActor,
    input: {
      title: string;
      content: string;
      type?: string;
      scope?: MemoryScope;
      tags?: string[];
      memoryId?: string | null;
    },
  ): { doc: TeamDocument; memory: ScopedMemoryRecord } {
    const scope = input.scope ?? defaultScopeForDecision();
    this.gate.assert({
      scope,
      action: 'write',
      role: actor.role,
      actorId: actor.id,
    });

    const id = newId('tm');
    const status: DecisionReviewStatus = isSharedScope(scope) ? 'pending_review' : 'active';
    const memory: ScopedMemoryRecord = {
      id,
      memoryId: input.memoryId ?? null,
      projectId: doc.projectId,
      teamId: doc.teamId,
      organizationId: actor.organizationId,
      scope,
      title: input.title,
      content: input.content,
      type: input.type ?? 'architecture_decision',
      status,
      ownerId: actor.id,
      createdBy: actor.id,
      updatedBy: actor.id,
      approvedBy: status === 'active' ? actor.id : null,
      tags: input.tags ?? [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    let next: TeamDocument = {
      ...doc,
      memories: [...doc.memories, memory],
      updatedAt: nowIso(),
    };
    next = this.graph.recordCreatedBy(next, id, actor, memory.title);
    next = this.contrib.record(next, {
      memoryId: id,
      createdBy: actor.id,
      updatedBy: actor.id,
      approvedBy: memory.approvedBy,
      scope,
      action: 'created',
    });
    next = this.audit.append(next, {
      memoryId: id,
      actorId: actor.id,
      action: 'create',
      scope,
      detail: status === 'pending_review' ? 'Proposed for review' : 'Personal/auto-active',
    });

    return { doc: next, memory };
  }

  approve(
    doc: TeamDocument,
    actor: LocalActor,
    memoryId: string,
  ): { doc: TeamDocument; memory: ScopedMemoryRecord } {
    const existing = doc.memories.find((m) => m.id === memoryId);
    if (!existing) throw new Error(`Unknown team memory: ${memoryId}`);
    if (existing.status !== 'pending_review' && existing.status !== 'proposed') {
      throw new Error(`Cannot approve memory in status ${existing.status}`);
    }
    this.gate.assert({
      scope: existing.scope,
      action: 'approve',
      role: actor.role,
      actorId: actor.id,
      ownerId: existing.ownerId,
    });

    const memory: ScopedMemoryRecord = {
      ...existing,
      status: 'active',
      approvedBy: actor.id,
      updatedBy: actor.id,
      updatedAt: nowIso(),
    };

    let next: TeamDocument = {
      ...doc,
      memories: doc.memories.map((m) => (m.id === memoryId ? memory : m)),
      updatedAt: nowIso(),
    };
    next = this.graph.recordApprovedBy(next, memoryId, actor);
    next = this.contrib.record(next, {
      memoryId,
      createdBy: memory.createdBy,
      updatedBy: actor.id,
      approvedBy: actor.id,
      scope: memory.scope,
      action: 'approved',
    });
    next = this.audit.append(next, {
      memoryId,
      actorId: actor.id,
      action: 'approve',
      scope: memory.scope,
      detail: 'Decision became official',
    });

    return { doc: next, memory };
  }

  reject(doc: TeamDocument, actor: LocalActor, memoryId: string, reason?: string): TeamDocument {
    const existing = doc.memories.find((m) => m.id === memoryId);
    if (!existing) throw new Error(`Unknown team memory: ${memoryId}`);
    this.gate.assert({
      scope: existing.scope,
      action: 'approve',
      role: actor.role,
      actorId: actor.id,
      ownerId: existing.ownerId,
    });

    let next: TeamDocument = {
      ...doc,
      memories: doc.memories.map((m) =>
        m.id === memoryId
          ? { ...m, status: 'rejected' as const, updatedBy: actor.id, updatedAt: nowIso() }
          : m,
      ),
      updatedAt: nowIso(),
    };
    next = this.audit.append(next, {
      memoryId,
      actorId: actor.id,
      action: 'reject',
      scope: existing.scope,
      detail: reason ?? 'Rejected',
    });
    return next;
  }

  archive(doc: TeamDocument, actor: LocalActor, memoryId: string): TeamDocument {
    const existing = doc.memories.find((m) => m.id === memoryId);
    if (!existing) throw new Error(`Unknown team memory: ${memoryId}`);
    this.gate.assert({
      scope: existing.scope,
      action: 'archive',
      role: actor.role,
      actorId: actor.id,
      ownerId: existing.ownerId,
    });

    let next: TeamDocument = {
      ...doc,
      memories: doc.memories.map((m) =>
        m.id === memoryId
          ? { ...m, status: 'archived' as const, updatedBy: actor.id, updatedAt: nowIso() }
          : m,
      ),
      updatedAt: nowIso(),
    };
    next = this.contrib.record(next, {
      memoryId,
      createdBy: existing.createdBy,
      updatedBy: actor.id,
      approvedBy: existing.approvedBy,
      scope: existing.scope,
      action: 'archived',
    });
    next = this.audit.append(next, {
      memoryId,
      actorId: actor.id,
      action: 'archive',
      scope: existing.scope,
    });
    return next;
  }
}

export function createDecisionReviewWorkflow(): DecisionReviewWorkflow {
  return new DecisionReviewWorkflow();
}

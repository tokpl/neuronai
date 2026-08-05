import type { LocalActor, ScopedMemoryRecord, TeamDocument } from '@neuron-ai-memory/team-memory';
import { createDecisionReviewWorkflow } from '@neuron-ai-memory/team-memory';

import type { ApprovalStatus, SharedMemory } from '../types.js';
import { createKnowledgePermissions } from '../permissions/knowledge-permissions.js';
import { toSharedMemory } from './mapper.js';

/**
 * MemoryApprovalFlow — DRAFT → REVIEW → APPROVED → ARCHIVED.
 * Not every fact auto-publishes to the team brain.
 */
export class MemoryApprovalFlow {
  private readonly workflow = createDecisionReviewWorkflow();
  private readonly permissions = createKnowledgePermissions();

  propose(
    doc: TeamDocument,
    actor: LocalActor,
    input: { title: string; content: string; type?: string; tags?: string[] },
  ): { doc: TeamDocument; memory: SharedMemory } {
    this.permissions.assert(this.permissions.levelFromRole(actor.role), 'SUGGEST');
    const result = this.workflow.propose(doc, actor, {
      title: input.title,
      content: input.content,
      type: input.type ?? 'architecture_decision',
      scope: 'TEAM',
      tags: input.tags,
    });
    return {
      doc: result.doc,
      memory: toSharedMemory(result.memory),
    };
  }

  approve(
    doc: TeamDocument,
    actor: LocalActor,
    memoryId: string,
  ): { doc: TeamDocument; memory: SharedMemory } {
    this.permissions.assert(this.permissions.levelFromRole(actor.role), 'APPROVE');
    const result = this.workflow.approve(doc, actor, memoryId);
    return {
      doc: result.doc,
      memory: toSharedMemory(result.memory),
    };
  }

  statusOf(record: ScopedMemoryRecord): ApprovalStatus {
    return toSharedMemory(record).status;
  }
}

export function createMemoryApprovalFlow(): MemoryApprovalFlow {
  return new MemoryApprovalFlow();
}

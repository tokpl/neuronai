import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { ArchiveProposal, MemoryLifecycleState } from '../types.js';

/**
 * MemoryArchive — move ACTIVE → ARCHIVED (proposal). Never deletes.
 */
export class MemoryArchive {
  propose(
    memory: MemoryRecord,
    reason: string,
    fromLifecycle: MemoryLifecycleState = 'OUTDATED',
  ): ArchiveProposal {
    return {
      memoryId: memory.id,
      title: memory.title,
      reason,
      fromLifecycle,
      toLifecycle: 'ARCHIVED',
      requiresApproval: true,
    };
  }

  proposeMany(
    memories: MemoryRecord[],
    reason: string,
  ): ArchiveProposal[] {
    return memories
      .filter((m) => m.status === 'active')
      .map((m) => this.propose(m, reason, 'OUTDATED'));
  }
}

export function createMemoryArchive(): MemoryArchive {
  return new MemoryArchive();
}

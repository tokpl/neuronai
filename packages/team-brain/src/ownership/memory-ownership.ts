import type { MemoryOwnership } from '../types.js';

/**
 * MemoryOwnership — creator, contributors, source.
 * Example: "Use PostgreSQL" created by Senior, approved by Team.
 */
export class MemoryOwnershipService {
  create(input: {
    creator: string;
    source?: string;
    contributors?: string[];
    approvedBy?: string | null;
  }): MemoryOwnership {
    return {
      creator: input.creator,
      contributors: [...new Set([input.creator, ...(input.contributors ?? [])])],
      source: input.source ?? 'manual',
      approvedBy: input.approvedBy ?? null,
    };
  }

  addContributor(ownership: MemoryOwnership, actorId: string): MemoryOwnership {
    return {
      ...ownership,
      contributors: [...new Set([...ownership.contributors, actorId])],
    };
  }

  describe(ownership: MemoryOwnership): string {
    const approved = ownership.approvedBy
      ? `Approved by: ${ownership.approvedBy}`
      : 'Pending approval';
    return [
      `Created by: ${ownership.creator}`,
      `Contributors: ${ownership.contributors.join(', ') || '—'}`,
      `Source: ${ownership.source}`,
      approved,
    ].join('\n');
  }
}

export function createMemoryOwnershipService(): MemoryOwnershipService {
  return new MemoryOwnershipService();
}

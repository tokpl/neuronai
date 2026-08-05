import type { KnowledgeContribution, MemoryScope, TeamDocument } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Tracks who created / changed / approved shared knowledge.
 */
export class ContributionTracker {
  record(
    doc: TeamDocument,
    input: {
      memoryId: string;
      createdBy: string;
      updatedBy: string;
      approvedBy: string | null;
      scope: MemoryScope;
      action: KnowledgeContribution['action'];
    },
  ): TeamDocument {
    const c: KnowledgeContribution = {
      id: newId('contrib'),
      memoryId: input.memoryId,
      projectId: doc.projectId,
      createdBy: input.createdBy,
      updatedBy: input.updatedBy,
      approvedBy: input.approvedBy,
      scope: input.scope,
      action: input.action,
      at: nowIso(),
    };
    return {
      ...doc,
      contributions: [...doc.contributions, c].slice(-5_000),
      updatedAt: nowIso(),
    };
  }

  forMemory(doc: TeamDocument, memoryId: string): KnowledgeContribution[] {
    return doc.contributions.filter((c) => c.memoryId === memoryId);
  }

  topContributors(doc: TeamDocument, limit = 20): Array<{ actorId: string; count: number }> {
    const map = new Map<string, number>();
    for (const c of doc.contributions) {
      map.set(c.createdBy, (map.get(c.createdBy) ?? 0) + 1);
      if (c.approvedBy) map.set(c.approvedBy, (map.get(c.approvedBy) ?? 0) + 0.5);
    }
    return [...map.entries()]
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export function createContributionTracker(): ContributionTracker {
  return new ContributionTracker();
}

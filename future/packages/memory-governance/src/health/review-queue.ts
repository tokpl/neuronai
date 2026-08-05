import type { MemoryRecord } from '@neuron-ai-memory/types';

import type {
  CleanupSuggestion,
  ConflictResolutionSuggestion,
  DuplicateSuggestion,
  ReviewPriority,
  ReviewQueueItem,
  StaleSignal,
} from '../types.js';
import { createGovernancePolicyEngine } from '../policies/policy-engine.js';

const PRIORITY_RANK: Record<ReviewPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Aggregates stale / conflict / duplicate / policy signals into a review queue.
 * Neuron proposes — developer decides.
 */
export class MemoryReviewQueue {
  private readonly policies = createGovernancePolicyEngine();

  build(input: {
    memories: MemoryRecord[];
    stale: StaleSignal[];
    conflicts: ConflictResolutionSuggestion[];
    duplicates: DuplicateSuggestion[];
    now?: Date;
  }): ReviewQueueItem[] {
    const byId = new Map(input.memories.map((m) => [m.id, m]));
    const items: ReviewQueueItem[] = [];

    for (const s of input.stale) {
      const m = byId.get(s.memoryId);
      items.push({
        memoryId: s.memoryId,
        title: m?.title ?? s.memoryId,
        reason: s.reason,
        priority: s.priority,
        suggestedAction: 'review',
        why: `${s.reason}: ${s.evidence.join('; ')}`,
      });
    }

    for (const c of input.conflicts) {
      items.push({
        memoryId: c.olderId,
        title: c.olderTitle,
        reason: `Conflict: ${c.topic}`,
        priority: 'high',
        suggestedAction: 'supersede',
        why: c.why,
      });
    }

    for (const d of input.duplicates) {
      items.push({
        memoryId: d.leftId,
        title: d.leftTitle,
        reason: `Possible duplicate of "${d.rightTitle}"`,
        priority: d.similarity > 0.75 ? 'high' : 'medium',
        suggestedAction: 'merge',
        why: d.why,
      });
    }

    const now = input.now ?? new Date();
    for (const m of input.memories) {
      if (m.status !== 'active') continue;
      for (const p of this.policies.dueForReview(m, now)) {
        items.push({
          memoryId: m.id,
          title: m.title,
          reason: `Policy due: ${p.name}`,
          priority: p.neverAutoArchive ? 'critical' : 'medium',
          suggestedAction: 'review',
          why: p.whySuggested,
          policyId: p.id,
        });
      }
    }

    return dedupeQueue(items).sort(
      (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
    );
  }

  toCleanupSuggestions(
    queue: ReviewQueueItem[],
    extras: {
      conflicts: ConflictResolutionSuggestion[];
      duplicates: DuplicateSuggestion[];
    },
  ): CleanupSuggestion[] {
    const suggestions: CleanupSuggestion[] = [];

    for (const c of extras.conflicts) {
      suggestions.push({
        id: `conflict:${c.olderId}:${c.newerId}`,
        kind: 'conflict',
        memoryIds: [c.olderId, c.newerId],
        action: 'supersede',
        title: c.resolution,
        detail: `${c.olderTitle} → superseded by ${c.newerTitle}`,
        why: c.why,
        priority: 'high',
        requiresApproval: true,
      });
    }

    for (const d of extras.duplicates) {
      suggestions.push({
        id: `dup:${d.leftId}:${d.rightId}`,
        kind: 'duplicate',
        memoryIds: [d.leftId, d.rightId],
        action: 'merge',
        title: d.mergeHint,
        detail: `similarity=${(d.similarity * 100).toFixed(0)}%`,
        why: d.why,
        priority: d.similarity > 0.75 ? 'high' : 'medium',
        requiresApproval: true,
      });
    }

    for (const q of queue) {
      if (q.suggestedAction === 'merge' || q.suggestedAction === 'supersede') continue;
      suggestions.push({
        id: `review:${q.memoryId}:${q.policyId ?? q.reason.slice(0, 24)}`,
        kind: q.policyId ? 'policy' : 'stale',
        memoryIds: [q.memoryId],
        action: q.suggestedAction,
        title: q.reason,
        detail: q.title,
        why: q.why,
        priority: q.priority,
        requiresApproval: true,
      });
    }

    return suggestions;
  }
}

function dedupeQueue(items: ReviewQueueItem[]): ReviewQueueItem[] {
  const map = new Map<string, ReviewQueueItem>();
  for (const item of items) {
    const key = `${item.memoryId}|${item.suggestedAction}|${item.reason}`;
    const prev = map.get(key);
    if (!prev || PRIORITY_RANK[item.priority] > PRIORITY_RANK[prev.priority]) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

export function createMemoryReviewQueue(): MemoryReviewQueue {
  return new MemoryReviewQueue();
}

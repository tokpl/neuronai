import type {
  CleanupOperation,
  CleanupSuggestion,
  ConflictResolutionSuggestion,
  DuplicateSuggestion,
} from '../types.js';
import { newId } from '../types.js';

/**
 * CleanupEngine — merge / archive / invalidate / recalculate proposals.
 * Never permanent delete. Never applies without approval.
 */
export class CleanupEngine {
  fromSuggestions(suggestions: CleanupSuggestion[]): CleanupOperation[] {
    return suggestions.map((s) => ({
      id: newId('clean'),
      action: s.action,
      memoryIds: s.memoryIds,
      detail: `${s.title}: ${s.detail}`,
      requiresApproval: true as const,
      permanentDelete: false as const,
    }));
  }

  planMerge(dups: DuplicateSuggestion[]): CleanupOperation[] {
    return dups.map((d) => ({
      id: newId('clean'),
      action: 'merge' as const,
      memoryIds: [d.leftId, d.rightId],
      detail: d.mergeHint,
      requiresApproval: true as const,
      permanentDelete: false as const,
    }));
  }

  planSupersede(conflicts: ConflictResolutionSuggestion[]): CleanupOperation[] {
    return conflicts.map((c) => ({
      id: newId('clean'),
      action: 'supersede' as const,
      memoryIds: [c.olderId, c.newerId],
      detail: c.resolution,
      requiresApproval: true as const,
      permanentDelete: false as const,
    }));
  }

  planRecalculate(memoryIds: string[]): CleanupOperation {
    return {
      id: newId('clean'),
      action: 'recalculate',
      memoryIds,
      detail: 'Recalculate importance, decay, and health scores',
      requiresApproval: true,
      permanentDelete: false,
    };
  }

  planInvalidate(memoryIds: string[], reason: string): CleanupOperation {
    return {
      id: newId('clean'),
      action: 'invalidate',
      memoryIds,
      detail: `Mark outdated / invalidate current truth: ${reason}`,
      requiresApproval: true,
      permanentDelete: false,
    };
  }
}

export function createCleanupEngine(): CleanupEngine {
  return new CleanupEngine();
}

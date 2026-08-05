import type { MemoryRecord, MemoryRelationRecord } from '@neuron-ai-memory/types';
import { jaccardLike } from './similarity.js';

export interface MaintenanceReport {
  duplicatesFound: number;
  staleFound: number;
  orphanRelations: number;
  archivedIds: string[];
  recommendations: string[];
}

export interface MemoryMaintenanceInput {
  memories: MemoryRecord[];
  relations?: MemoryRelationRecord[];
  /** Days without use before considered stale (default 180) */
  staleDays?: number;
  /** Jaccard threshold for duplicate titles/content */
  duplicateThreshold?: number;
  now?: Date;
}

/**
 * Offline maintenance over a memory snapshot (local or exported).
 * Does not delete — returns candidates; caller persists archives/deletes.
 */
export class MemoryMaintenanceService {
  analyze(input: MemoryMaintenanceInput): MaintenanceReport {
    const now = input.now ?? new Date();
    const staleDays = input.staleDays ?? 180;
    const threshold = input.duplicateThreshold ?? 0.85;
    const active = input.memories.filter((m) => m.status === 'active');

    const archivedIds: string[] = [];
    const recommendations: string[] = [];
    let duplicatesFound = 0;
    let staleFound = 0;

    for (let i = 0; i < active.length; i++) {
      const a = active[i]!;
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j]!;
        const score = Math.max(
          jaccardLike(a.title, b.title),
          jaccardLike(a.content, b.content),
        );
        if (score >= threshold) {
          duplicatesFound += 1;
          // Prefer keeping higher importance
          const loser = a.importanceScore >= b.importanceScore ? b : a;
          if (!archivedIds.includes(loser.id)) archivedIds.push(loser.id);
          recommendations.push(
            `Duplicate ~${score.toFixed(2)}: keep "${a.importanceScore >= b.importanceScore ? a.title : b.title}"`,
          );
        }
      }
    }

    const cutoff = now.getTime() - staleDays * 86_400_000;
    for (const m of active) {
      const last = m.lastUsedAt ? Date.parse(m.lastUsedAt) : Date.parse(m.updatedAt);
      if (Number.isFinite(last) && last < cutoff && m.importanceScore < 0.5) {
        staleFound += 1;
        if (!archivedIds.includes(m.id)) archivedIds.push(m.id);
        recommendations.push(`Stale low-importance memory: ${m.title}`);
      }
    }

    const memoryIds = new Set(input.memories.map((m) => m.id));
    let orphanRelations = 0;
    for (const rel of input.relations ?? []) {
      if (!memoryIds.has(rel.fromMemoryId) || !memoryIds.has(rel.toMemoryId)) {
        orphanRelations += 1;
      }
    }
    if (orphanRelations > 0) {
      recommendations.push(`Found ${orphanRelations} orphan relation(s)`);
    }

    return {
      duplicatesFound,
      staleFound,
      orphanRelations,
      archivedIds: [...new Set(archivedIds)],
      recommendations: recommendations.slice(0, 50),
    };
  }
}

export function createMemoryMaintenanceService(): MemoryMaintenanceService {
  return new MemoryMaintenanceService();
}

import type { MemoryRecord } from '@neuronai/types';

import { jaccardSimilarity } from '../conflict/conflict-detector.js';

export interface ConsolidationGroup {
  primary: MemoryRecord;
  duplicates: MemoryRecord[];
  mergedContent: string;
  mergedTitle: string;
}

export class MemoryConsolidator {
  /**
   * Groups near-duplicate active memories (same project + high Jaccard).
   * Does not persist - caller decides how to merge via Memory Engine.
   */
  findGroups(memories: MemoryRecord[], threshold = 0.82): ConsolidationGroup[] {
    const active = memories.filter((m) => m.status === 'active');
    const used = new Set<string>();
    const groups: ConsolidationGroup[] = [];

    for (let i = 0; i < active.length; i++) {
      const primary = active[i]!;
      if (used.has(primary.id)) continue;
      const duplicates: MemoryRecord[] = [];

      for (let j = i + 1; j < active.length; j++) {
        const other = active[j]!;
        if (used.has(other.id)) continue;
        if (primary.projectId !== other.projectId) continue;
        if (primary.type !== other.type) continue;
        const sim = Math.max(
          jaccardSimilarity(primary.title, other.title),
          jaccardSimilarity(primary.content, other.content),
        );
        if (sim >= threshold) {
          duplicates.push(other);
          used.add(other.id);
        }
      }

      if (duplicates.length > 0) {
        used.add(primary.id);
        const all = [primary, ...duplicates].sort((a, b) => b.importanceScore - a.importanceScore);
        const head = all[0]!;
        groups.push({
          primary: head,
          duplicates: all.slice(1),
          mergedTitle: head.title,
          mergedContent: pickRichestContent(all),
        });
      }
    }

    return groups;
  }
}

function pickRichestContent(memories: MemoryRecord[]): string {
  return [...memories].sort((a, b) => b.content.length - a.content.length)[0]!.content;
}

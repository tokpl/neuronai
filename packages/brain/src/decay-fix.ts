import { nowIso } from './defaults.js';
import { findStaleMemories, type DecayFinding } from './decay.js';
import type { ProjectBrain } from './project-brain.js';

export interface DecayFixResult {
  findings: DecayFinding[];
  archived: number;
  ids: string[];
}

/**
 * Archive memories whose referenced files are all missing (status → archived).
 * Does not delete — recoverable via review.
 */
export function applyDecayFix(brain: ProjectBrain): DecayFixResult {
  const findings = findStaleMemories(brain);
  if (findings.length === 0) {
    return { findings: [], archived: 0, ids: [] };
  }
  const staleIds = new Set(findings.map((f) => f.id));
  const ids: string[] = [];

  brain.knowledge = {
    ...brain.knowledge,
    memory: brain.knowledge.memory.map((m) => {
      if (!staleIds.has(m.id)) return m;
      ids.push(m.id);
      return { ...m, status: 'archived' as const, updatedAt: nowIso() };
    }),
    decisions: brain.knowledge.decisions.map((m) => {
      if (!staleIds.has(m.id)) return m;
      ids.push(m.id);
      return { ...m, status: 'archived' as const, updatedAt: nowIso() };
    }),
    updatedAt: nowIso(),
  };

  return { findings, archived: ids.length, ids };
}

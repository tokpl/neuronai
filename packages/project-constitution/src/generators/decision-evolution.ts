import type { MemoryRecord } from '@neuron-ai-memory/types';

import {
  newRuleId,
  nowIso,
  type ProjectConstitutionDocument,
} from '../rules/types.js';

/**
 * Track architecture decision evolution: current state + history + reason.
 */
export class DecisionEvolutionTracker {
  syncFromMemories(
    doc: ProjectConstitutionDocument,
    memories: MemoryRecord[],
  ): ProjectConstitutionDocument {
    const decisions = memories.filter(
      (m) => m.status === 'active' && m.type === 'architecture_decision',
    );
    const next = { ...doc, decisions: [...doc.decisions] };

    for (const m of decisions) {
      const existing = next.decisions.find(
        (d) => d.memoryId === m.id || d.title.toLowerCase() === m.title.toLowerCase(),
      );
      const state = extractDecisionState(m.content) || m.title;
      if (!existing) {
        next.decisions.push({
          id: newRuleId(),
          title: m.title,
          currentState: state,
          history: [{ version: 1, state, reason: 'Initial recorded decision', at: m.createdAt }],
          memoryId: m.id,
          updatedAt: m.updatedAt,
        });
      } else if (existing.currentState !== state && m.version > existing.history.length) {
        existing.history.push({
          version: existing.history.length + 1,
          state,
          reason: extractReason(m.content) || 'Updated decision',
          at: m.updatedAt,
        });
        existing.currentState = state;
        existing.updatedAt = m.updatedAt;
        existing.memoryId = m.id;
      }
    }

    return { ...next, updatedAt: nowIso() };
  }

  evolve(
    doc: ProjectConstitutionDocument,
    input: { title: string; newState: string; reason: string },
  ): ProjectConstitutionDocument {
    const existing = doc.decisions.find(
      (d) => d.title.toLowerCase() === input.title.toLowerCase(),
    );
    const now = nowIso();
    if (!existing) {
      return {
        ...doc,
        updatedAt: now,
        decisions: [
          ...doc.decisions,
          {
            id: newRuleId(),
            title: input.title,
            currentState: input.newState,
            history: [{ version: 1, state: input.newState, reason: input.reason, at: now }],
            updatedAt: now,
          },
        ],
      };
    }
    const version = existing.history.length + 1;
    return {
      ...doc,
      updatedAt: now,
      decisions: doc.decisions.map((d) =>
        d.id === existing.id
          ? {
              ...d,
              currentState: input.newState,
              history: [
                ...d.history,
                { version, state: input.newState, reason: input.reason, at: now },
              ],
              updatedAt: now,
            }
          : d,
      ),
    };
  }
}

function extractDecisionState(content: string): string | undefined {
  const m = content.match(/Decision:\s*(.+)/i);
  return m?.[1]?.trim();
}

function extractReason(content: string): string | undefined {
  const m = content.match(/Reason:\s*(.+)/i);
  return m?.[1]?.trim();
}

export function createDecisionEvolutionTracker(): DecisionEvolutionTracker {
  return new DecisionEvolutionTracker();
}

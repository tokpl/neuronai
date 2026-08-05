import type { LocalActor, MemoryScope, ScopedMemoryRecord, TeamDocument } from '../types.js';
import { createPermissionGate } from '../permissions/gate.js';
import { scopeRank } from '../permissions/gate.js';

export interface TeamRetrievalHit {
  memory: ScopedMemoryRecord;
  personalRelevance: number;
  teamScore: number;
  projectScore: number;
  finalScore: number;
}

/**
 * Extends retrieval with personal / team / project knowledge weighting.
 * Local-only; plug into RetrievalEngine as an extra source later.
 */
export class TeamRetrievalScorer {
  private readonly gate = createPermissionGate();

  score(
    doc: TeamDocument,
    actor: LocalActor,
    query: string,
  ): TeamRetrievalHit[] {
    const q = query.toLowerCase();
    const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);

    return doc.memories
      .filter((m) => {
        if (m.status !== 'active' && m.status !== 'approved') return false;
        if (m.scope === 'PERSONAL' && m.ownerId !== actor.id) return false;
        return this.gate.can({
          scope: m.scope,
          action: 'read',
          role: actor.role,
          actorId: actor.id,
          ownerId: m.ownerId,
        });
      })
      .map((memory) => {
        const hay = `${memory.title} ${memory.content}`.toLowerCase();
        const overlap = tokens.filter((t) => hay.includes(t)).length;
        const relevance = Math.min(1, overlap / Math.max(3, tokens.length));

        const personalRelevance =
          memory.scope === 'PERSONAL' && memory.ownerId === actor.id
            ? 0.9 * relevance + 0.1
            : memory.createdBy === actor.id
              ? 0.4 * relevance
              : 0.15 * relevance;

        const teamScore =
          memory.scope === 'TEAM' || memory.scope === 'ORGANIZATION'
            ? 0.85 * relevance + 0.1
            : 0.2 * relevance;

        const projectScore =
          memory.scope === 'PROJECT' ? 0.9 * relevance + 0.05 : 0.25 * relevance;

        const scopeBoost = scopeRank(memory.scope) * 0.03;
        const finalScore = Math.min(
          1,
          0.35 * personalRelevance + 0.3 * teamScore + 0.35 * projectScore + scopeBoost,
        );

        return { memory, personalRelevance, teamScore, projectScore, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  filterByScopes(hits: TeamRetrievalHit[], scopes: MemoryScope[]): TeamRetrievalHit[] {
    const set = new Set(scopes);
    return hits.filter((h) => set.has(h.memory.scope));
  }
}

export function createTeamRetrievalScorer(): TeamRetrievalScorer {
  return new TeamRetrievalScorer();
}

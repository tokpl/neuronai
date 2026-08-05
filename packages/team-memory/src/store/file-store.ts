import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { LocalActor, TeamDocument } from '../types.js';
import { nowIso } from '../types.js';
import { createTeamKnowledgeGraph } from '../graph/team-graph.js';

export function emptyTeamDocument(input: {
  projectId: string;
  teamId?: string;
  teamName?: string;
  actors?: LocalActor[];
}): TeamDocument {
  const teamId = input.teamId ?? `team-${input.projectId.slice(0, 8)}`;
  const doc: TeamDocument = {
    version: 1,
    projectId: input.projectId,
    teamId,
    teamName: input.teamName ?? 'Local team',
    actors: input.actors ?? [
      {
        id: 'local-dev',
        displayName: 'Local Developer',
        role: 'owner',
        teamId,
      },
    ],
    memories: [],
    contributions: [],
    audit: [],
    graph: { nodes: [], edges: [] },
    updatedAt: nowIso(),
  };
  return createTeamKnowledgeGraph().ensureBase(doc);
}

export class TeamMemoryStore {
  constructor(private readonly filePath: string) {}

  async load(seed: { projectId: string; teamName?: string }): Promise<TeamDocument> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as TeamDocument;
      if (raw.version !== 1) return emptyTeamDocument(seed);
      return createTeamKnowledgeGraph().ensureBase(raw);
    } catch {
      return emptyTeamDocument(seed);
    }
  }

  async save(doc: TeamDocument): Promise<void> {
    await mkdir(join(this.filePath, '..'), { recursive: true });
    await writeFile(this.filePath, JSON.stringify({ ...doc, updatedAt: nowIso() }, null, 2), 'utf8');
  }
}

export function createTeamMemoryStore(neuronDir: string): TeamMemoryStore {
  return new TeamMemoryStore(join(neuronDir, 'team', 'team-memory.json'));
}

export function resolveLocalActor(
  doc: TeamDocument,
  hint?: { actorId?: string; displayName?: string; role?: LocalActor['role'] },
): LocalActor {
  if (hint?.actorId) {
    const found = doc.actors.find((a) => a.id === hint.actorId);
    if (found) return found;
  }
  if (hint?.displayName) {
    const found = doc.actors.find(
      (a) => a.displayName.toLowerCase() === hint.displayName!.toLowerCase(),
    );
    if (found) return found;
  }
  const primary = doc.actors[0];
  if (primary) {
    if (hint?.role && hint.role !== primary.role) {
      return { ...primary, role: hint.role };
    }
    return primary;
  }
  return {
    id: hint?.actorId ?? 'local-dev',
    displayName: hint?.displayName ?? 'Local Developer',
    role: hint?.role ?? 'owner',
    teamId: doc.teamId,
  };
}

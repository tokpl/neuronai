import { findDuplicate } from '@neuronai/brain';
import { buildProjectKnowledgeCandidates } from '@neuronai/project-analyzer';
import { createNeuronRuntime, type NeuronRuntime } from '@neuronai/storage';
import type { MemoryRecord } from '@neuronai/types';

import { loadMetadata, saveMetadata } from './neuron-fs.js';

/**
 * CLI session = the shared runtime plus CLI-only metadata bookkeeping.
 * The MCP server builds the same runtime the same way.
 */
export type ProjectSession = NeuronRuntime;

export async function openProjectSession(cwd = process.cwd()): Promise<ProjectSession> {
  return createNeuronRuntime({
    cwd,
    onPersist: async (runtime) => {
      const meta = await loadMetadata(cwd);
      meta.memoryCount = runtime.listMemories().length;
      meta.lastSyncAt = new Date().toISOString();
      await saveMetadata(meta, cwd);
    },
  });
}

export interface AnalyzeResult {
  candidates: number;
  stored: number;
  skipped: number;
  memories: MemoryRecord[];
}

/**
 * Seed knowledge derived from project manifests.
 * Duplicates are skipped rather than stored — the store stays clean from day one.
 */
export async function analyzeAndSeedMemories(
  session: ProjectSession,
  _options: { threshold?: number } = {},
): Promise<AnalyzeResult> {
  const candidates = buildProjectKnowledgeCandidates(session.project);
  const created: MemoryRecord[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const duplicate = findDuplicate(
      { type: candidate.type, title: candidate.title, content: candidate.content },
      session.listMemories(),
    );
    if (duplicate) {
      skipped += 1;
      continue;
    }

    try {
      created.push(
        await session.engine.createMemory({
          projectId: session.project.projectId,
          type: candidate.type,
          title: candidate.title,
          content: candidate.content,
          source: 'documentation',
          tags: ['project-analysis', ...session.project.frameworks],
          confidence: 0.85,
        }),
      );
    } catch {
      skipped += 1;
    }
  }

  await session.persist();
  const meta = await loadMetadata(session.cwd);
  meta.lastAnalyzeAt = new Date().toISOString();
  meta.memoryCount = session.listMemories().length;
  const { readGitIdentity } = await import('./git-identity.js');
  const git = readGitIdentity(session.cwd);
  meta.lastScanGitHead = git.head;
  meta.lastScanGitBranch = git.branch;
  await saveMetadata(meta, session.cwd);

  return {
    candidates: candidates.length,
    stored: created.length,
    skipped,
    memories: created,
  };
}

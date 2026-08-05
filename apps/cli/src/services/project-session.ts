import { MockAIProvider } from '@neuron-ai-memory/ai-provider';
import {
  createMemoryIntelligencePipeline,
  HybridMemorySearchEngine,
  ImportanceEngine,
  type MemoryIntelligencePipeline,
  type MemorySearchEngine,
} from '@neuron-ai-memory/ai-memory';
import { InMemoryEmbeddingStore, MockEmbeddingProvider } from '@neuron-ai-memory/embeddings';
import type { MemoryEngine } from '@neuron-ai-memory/memory-engine';
import {
  buildProjectKnowledgeCandidates,
  createProjectResolver,
  type ResolvedProject,
} from '@neuron-ai-memory/project-analyzer';
import { createLocalFileMemoryStack } from '@neuron-ai-memory/storage';
import type { MemoryRecord, MemoryType } from '@neuron-ai-memory/types';

import { loadMetadata, saveMetadata } from './neuron-fs.js';

export interface ProjectSession {
  cwd: string;
  project: ResolvedProject;
  engine: MemoryEngine;
  pipeline: MemoryIntelligencePipeline;
  searchEngine: MemorySearchEngine;
  persist: () => Promise<void>;
  listMemories: () => MemoryRecord[];
}

export async function openProjectSession(cwd = process.cwd()): Promise<ProjectSession> {
  const project = await createProjectResolver().resolve(cwd);
  const local = await createLocalFileMemoryStack(cwd);

  const embeddings = new MockEmbeddingProvider();
  const embeddingStore = new InMemoryEmbeddingStore();
  if (local.snapshot.embeddings?.length) {
    embeddingStore.importAll(local.snapshot.embeddings);
  }

  const searchEngine = new HybridMemorySearchEngine(local.memories, embeddings, embeddingStore);
  local.setSearcher({
    async search(input) {
      const hits = await searchEngine.search({
        projectId: input.projectId,
        query: input.query,
        limit: input.limit,
      });
      return {
        results: hits.map((h) => ({ memory: h.memory, score: h.score })),
      };
    },
  });

  const persist = async (): Promise<void> => {
    local.snapshot.embeddings = embeddingStore.exportAll();
    await local.persist();
    const meta = await loadMetadata(cwd);
    meta.memoryCount = local.memories.exportRecords().filter((m) => m.status === 'active').length;
    meta.lastSyncAt = new Date().toISOString();
    await saveMetadata(meta, cwd);
  };

  const engine: MemoryEngine = {
    createMemory: async (input) => {
      const memory = await local.engine.createMemory(input);
      await searchEngine.indexMemory(memory);
      await persist();
      return memory;
    },
    getMemory: (id) => local.engine.getMemory(id),
    searchMemory: (input) => local.engine.searchMemory(input),
    updateMemory: async (input) => {
      const memory = await local.engine.updateMemory(input);
      await searchEngine.indexMemory(memory);
      await persist();
      return memory;
    },
    archiveMemory: async (id) => {
      await local.engine.archiveMemory(id);
      await persist();
    },
    createMemoryVersion: async (input) => {
      const version = await local.engine.createMemoryVersion(input);
      await persist();
      return version;
    },
    createRelation: async (input) => {
      const relation = await local.engine.createRelation(input);
      await persist();
      return relation;
    },
    getProjectMemoryContext: (input) => local.engine.getProjectMemoryContext(input),
  };

  const pipeline = createMemoryIntelligencePipeline({
    engine,
    ai: new MockAIProvider(),
    searchEngine,
  });

  return {
    cwd,
    project,
    engine,
    pipeline,
    searchEngine,
    persist,
    listMemories: () => local.memories.exportRecords(),
  };
}

export interface AnalyzeResult {
  candidates: number;
  stored: number;
  skipped: number;
  memories: MemoryRecord[];
}

/**
 * Run project analysis and persist high-signal knowledge via ImportanceEngine.
 */
export async function analyzeAndSeedMemories(
  session: ProjectSession,
  options: { threshold?: number } = {},
): Promise<AnalyzeResult> {
  const threshold = options.threshold ?? 0.45;
  const importance = new ImportanceEngine();
  const candidates = buildProjectKnowledgeCandidates(session.project);
  let stored = 0;
  let skipped = 0;
  const created: MemoryRecord[] = [];

  for (const candidate of candidates) {
    const decision = importance.score({
      type: candidate.type as MemoryType,
      content: candidate.content,
      source: 'documentation',
      confidence: 0.85,
      projectImpact: 0.7,
      futureUsefulness: 0.8,
    });

    if (decision.score < threshold || decision.action === 'reject') {
      skipped += 1;
      continue;
    }

    try {
      const memory = await session.engine.createMemory({
        projectId: session.project.projectId,
        type: candidate.type,
        title: candidate.title,
        content: candidate.content,
        source: 'documentation',
        tags: ['project-analysis', ...session.project.frameworks],
        manualImportance: decision.score,
        confidence: 0.85,
      });
      await session.searchEngine.indexMemory(memory);
      created.push(memory);
      stored += 1;
    } catch {
      // Duplicate or validation — skip
      skipped += 1;
    }
  }

  await session.persist();
  const meta = await loadMetadata(session.cwd);
  meta.lastAnalyzeAt = new Date().toISOString();
  meta.memoryCount = session.listMemories().filter((m) => m.status === 'active').length;
  await saveMetadata(meta, session.cwd);

  return {
    candidates: candidates.length,
    stored,
    skipped,
    memories: created,
  };
}

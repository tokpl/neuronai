import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MockAIProvider } from '@neuron-ai-memory/ai-provider';
import {
  createAgentIntelligence,
  type AgentIntelligence,
} from '@neuron-ai-memory/agent-intelligence';
import {
  createAgentWorkflow,
  parsePrivacyMode,
  type AgentWorkflowOrchestrator,
  type PrivacyMode,
} from '@neuron-ai-memory/agent-workflow';
import {
  createMemoryIntelligencePipeline,
  HybridMemorySearchEngine,
  type MemoryIntelligencePipeline,
  type MemorySearchEngine,
} from '@neuron-ai-memory/ai-memory';
import type { NeuronConfig } from '@neuron-ai-memory/config';
import { loadConfig } from '@neuron-ai-memory/config';
import { InMemoryEmbeddingStore, MockEmbeddingProvider } from '@neuron-ai-memory/embeddings';
import {
  createFileGraphRepository,
  createProjectIntelligenceEngine,
  type ProjectIntelligenceEngine,
} from '@neuron-ai-memory/knowledge-graph';
import type { MemoryEngine } from '@neuron-ai-memory/memory-engine';
import { createProjectResolver, type ResolvedProject } from '@neuron-ai-memory/project-analyzer';
import { createLocalFileMemoryStack } from '@neuron-ai-memory/storage';
import { createLogger, type NeuronLogger } from '@neuron-ai-memory/observability';

import { createAuthProvider, type AuthProvider } from '../middleware/auth.js';

export interface NeuronRuntime {
  config: NeuronConfig;
  project: ResolvedProject;
  engine: MemoryEngine;
  pipeline: MemoryIntelligencePipeline;
  searchEngine: MemorySearchEngine;
  workflow: AgentWorkflowOrchestrator;
  intelligence: AgentIntelligence;
  projectIntelligence: ProjectIntelligenceEngine;
  privacyMode: PrivacyMode;
  auth: AuthProvider;
  logger: NeuronLogger;
  persist?: () => Promise<void>;
  dataDir?: string;
  cwd: string;
}

async function loadPrivacyMode(cwd: string): Promise<PrivacyMode> {
  try {
    const raw = JSON.parse(await readFile(join(cwd, '.neuron', 'config.json'), 'utf8')) as {
      privacy?: { mode?: string };
      workflow?: { privacyMode?: string };
    };
    return parsePrivacyMode(raw.privacy?.mode ?? raw.workflow?.privacyMode ?? 'suggest');
  } catch {
    return parsePrivacyMode(process.env['NEURON_PRIVACY_MODE']);
  }
}

export async function createNeuronRuntime(cwd = process.cwd()): Promise<NeuronRuntime> {
  const logger = createLogger({ name: 'mcp-server' });
  const config = await loadConfig({ optional: true, cwd });
  const project = await createProjectResolver().resolve(cwd);
  const privacyMode = await loadPrivacyMode(cwd);

  const dataDir = join(cwd, '.neuron', 'data');
  const local = await createLocalFileMemoryStack(dataDir);

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
  };

  const listActive = async () =>
    local.memories
      .exportRecords()
      .filter((m) => m.projectId === project.projectId && m.status === 'active');

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

  const workflow = createAgentWorkflow({
    projectId: project.projectId,
    privacy: privacyMode,
    engine,
    listExistingMemories: listActive,
  });

  const graphRepo = createFileGraphRepository(dataDir);
  const projectIntelligence = createProjectIntelligenceEngine(graphRepo);

  // Best-effort: build/refresh graph if empty (local DX)
  try {
    const existing = await graphRepo.findNodes({ projectId: project.projectId, type: 'PROJECT' });
    if (existing.length === 0) {
      const built = await projectIntelligence.analyzeProject(cwd, {
        memories: await listActive(),
      });
      logger.info(
        { nodes: built.stats.nodes, modules: built.stats.modules },
        'Project knowledge graph initialized',
      );
    }
  } catch (err) {
    logger.warn({ err }, 'Knowledge graph bootstrap skipped');
  }

  const intelligence = createAgentIntelligence({
    projectId: project.projectId,
    engine,
    searchEngine,
    intelligence: projectIntelligence,
    listMemories: listActive,
  });

  const auth = createAuthProvider(config.server.mode);

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, '.keep'), '', { flag: 'a' });

  logger.info(
    {
      project: project.name,
      projectId: project.projectId,
      stack: project.stack,
      mode: config.server.mode,
      privacyMode,
      dataDir,
    },
    'Neuron runtime ready',
  );

  return {
    config,
    project,
    engine,
    pipeline,
    searchEngine,
    workflow,
    intelligence,
    projectIntelligence,
    privacyMode,
    auth,
    logger,
    persist,
    dataDir,
    cwd,
  };
}

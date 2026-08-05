import type { MemoryRecord } from '@neuronai/types';

/** Curated project brain files under `.neuron/` (versioned in git). */
export interface NeuronBrain {
  version: 1;
  projectId: string;
  name: string;
  stack: string[];
  summary?: string;
  updatedAt: string;
}

export interface NeuronKnowledgeFile {
  version: 1;
  patterns: MemoryRecord[];
  warnings: MemoryRecord[];
  facts: MemoryRecord[];
  other: MemoryRecord[];
  updatedAt: string;
}

export interface NeuronDecisionsFile {
  version: 1;
  decisions: MemoryRecord[];
  updatedAt: string;
}

export interface NeuronRulesFile {
  version: 1;
  rules: Array<{ id: string; title: string; body: string; critical?: boolean }>;
  updatedAt: string;
}

export interface StorageStatus {
  backend: string;
  ready: boolean;
  projectRoot: string;
  neuronDir: string;
  note?: string;
}

/**
 * Storage abstraction - MVP ships FileStorageProvider only.
 * SQLite / Postgres are future / experimental.
 */
export interface StorageProvider {
  readonly name: string;
  ensureLayout(projectRoot: string): Promise<void>;
  migrateIfNeeded(projectRoot: string): Promise<{ migrated: boolean; notes: string[] }>;
  readBrain(projectRoot: string): Promise<NeuronBrain | undefined>;
  writeBrain(projectRoot: string, brain: NeuronBrain): Promise<void>;
  readKnowledge(projectRoot: string): Promise<NeuronKnowledgeFile>;
  writeKnowledge(projectRoot: string, knowledge: NeuronKnowledgeFile): Promise<void>;
  readDecisions(projectRoot: string): Promise<NeuronDecisionsFile>;
  writeDecisions(projectRoot: string, decisions: NeuronDecisionsFile): Promise<void>;
  readRules(projectRoot: string): Promise<NeuronRulesFile>;
  writeRules(projectRoot: string, rules: NeuronRulesFile): Promise<void>;
  /** Sync curated JSON views from a flat memory list. */
  syncFromMemories(projectRoot: string, memories: MemoryRecord[]): Promise<void>;
  status(projectRoot: string): Promise<StorageStatus>;
  paths(projectRoot: string): NeuronStoragePaths;
}

export interface NeuronStoragePaths {
  projectRoot: string;
  neuronDir: string;
  config: string;
  brain: string;
  knowledge: string;
  decisions: string;
  rules: string;
  graph: string;
  cacheDir: string;
  runtimeDir: string;
  indexesDir: string;
  logsDir: string;
  /** Engine snapshot (not versioned) */
  store: string;
}

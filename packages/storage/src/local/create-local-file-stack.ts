import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type {
  MemoryRecord,
  MemoryRelationRecord,
  MemoryVersionRecord,
} from '@neuronai/types';
import {
  createMemoryEngine,
  InMemoryMemoryRelationRepository,
  InMemoryMemoryRepository,
  InMemoryMemoryVersionRepository,
  type MemoryEngine,
  type MemorySearcher,
} from '@neuronai/memory-engine';

import {
  createFileStorageProvider,
  resolveNeuronPaths,
  type FileStorageProvider,
} from '../file/file-storage-provider.js';

export interface LocalFileSnapshot {
  version: 1;
  memories: MemoryRecord[];
  versions: MemoryVersionRecord[];
  relations: MemoryRelationRecord[];
  embeddings?: Array<{
    memoryId: string;
    projectId: string;
    vector: number[];
    model: string;
    contentHash: string;
  }>;
}

export interface LocalFileMemoryStack {
  engine: MemoryEngine;
  memories: InMemoryMemoryRepository;
  versions: InMemoryMemoryVersionRepository;
  relations: InMemoryMemoryRelationRepository;
  /** @deprecated use runtimeDir - kept for callers expecting dataDir */
  dataDir: string;
  runtimeDir: string;
  storePath: string;
  snapshot: LocalFileSnapshot;
  storage: FileStorageProvider;
  projectRoot: string;
  persist: () => Promise<void>;
  setSearcher: (searcher: MemorySearcher) => void;
}

function emptySnapshot(): LocalFileSnapshot {
  return { version: 1, memories: [], versions: [], relations: [], embeddings: [] };
}

async function loadSnapshot(storePath: string): Promise<LocalFileSnapshot> {
  try {
    const raw = JSON.parse(await readFile(storePath, 'utf8')) as LocalFileSnapshot;
    return {
      version: 1,
      memories: raw.memories ?? [],
      versions: raw.versions ?? [],
      relations: raw.relations ?? [],
      embeddings: raw.embeddings ?? [],
    };
  } catch (error) {
    const isMissing =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT';
    if (isMissing) return emptySnapshot();
    throw error;
  }
}

/**
 * Local filesystem memory stack under `.neuron/runtime/` (no Postgres required).
 * Also syncs curated `decisions.json` / `knowledge.json` for git-friendly Team Brain.
 *
 * @param projectRootOrRuntimeDir - project root (preferred) OR legacy `.neuron/data` path
 */
export async function createLocalFileMemoryStack(
  projectRootOrRuntimeDir: string,
  searcher?: MemorySearcher,
): Promise<LocalFileMemoryStack> {
  const storage = createFileStorageProvider();

  // Back-compat: callers historically passed `.neuron/data`
  const looksLikeDataDir =
    projectRootOrRuntimeDir.replace(/\\/g, '/').endsWith('/.neuron/data') ||
    projectRootOrRuntimeDir.replace(/\\/g, '/').endsWith('/.neuron/runtime');

  const projectRoot = looksLikeDataDir
    ? join(projectRootOrRuntimeDir, '..', '..')
    : projectRootOrRuntimeDir;

  await storage.migrateIfNeeded(projectRoot);
  await storage.ensureLayout(projectRoot);

  const paths = resolveNeuronPaths(projectRoot);
  const storePath = paths.store;
  await mkdir(dirname(storePath), { recursive: true });
  const snapshot = await loadSnapshot(storePath);

  const memories = new InMemoryMemoryRepository();
  const versions = new InMemoryMemoryVersionRepository();
  const relations = new InMemoryMemoryRelationRepository();
  memories.importRecords(snapshot.memories);
  versions.importRecords(snapshot.versions);
  relations.importRecords(snapshot.relations);

  let activeSearcher: MemorySearcher | undefined = searcher;

  const engine = createMemoryEngine({
    memories,
    versions,
    relations,
    searcher: {
      search: (input) => {
        if (!activeSearcher) {
          return Promise.resolve({ results: [] });
        }
        return activeSearcher.search(input);
      },
    },
  });

  const persist = async (): Promise<void> => {
    const next: LocalFileSnapshot = {
      version: 1,
      memories: memories.exportRecords(),
      versions: versions.exportRecords(),
      relations: relations.exportRecords(),
      embeddings: snapshot.embeddings ?? [],
    };
    snapshot.memories = next.memories;
    snapshot.versions = next.versions;
    snapshot.relations = next.relations;
    await writeFile(storePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await storage.syncFromMemories(projectRoot, next.memories);
  };

  return {
    engine,
    memories,
    versions,
    relations,
    dataDir: paths.runtimeDir,
    runtimeDir: paths.runtimeDir,
    storePath,
    snapshot,
    storage,
    projectRoot,
    persist,
    setSearcher: (next) => {
      activeSearcher = next;
    },
  };
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  MemoryRecord,
  MemoryRelationRecord,
  MemoryVersionRecord,
} from '@neuron-ai-memory/types';
import {
  createMemoryEngine,
  InMemoryMemoryRelationRepository,
  InMemoryMemoryRepository,
  InMemoryMemoryVersionRepository,
  type MemoryEngine,
  type MemorySearcher,
} from '@neuron-ai-memory/memory-engine';

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
  dataDir: string;
  storePath: string;
  snapshot: LocalFileSnapshot;
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
 * Local filesystem memory stack under `.neuron/data/` (no Postgres required).
 * Searcher can be attached after construction (hybrid embeddings live outside storage).
 */
export async function createLocalFileMemoryStack(
  dataDir: string,
  searcher?: MemorySearcher,
): Promise<LocalFileMemoryStack> {
  await mkdir(dataDir, { recursive: true });
  const storePath = join(dataDir, 'store.json');
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
  };

  return {
    engine,
    memories,
    versions,
    relations,
    dataDir,
    storePath,
    snapshot,
    persist,
    setSearcher: (next) => {
      activeSearcher = next;
    },
  };
}

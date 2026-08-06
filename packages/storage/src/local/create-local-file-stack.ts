import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { openProjectBrain, resolveBrainPaths, type ProjectBrain } from '@neuronai/brain';
import type { MemoryRecord, MemoryRelationRecord, MemoryVersionRecord } from '@neuronai/types';
import {
  createMemoryEngine,
  InMemoryMemoryRelationRepository,
  InMemoryMemoryRepository,
  InMemoryMemoryVersionRepository,
  type MemoryEngine,
  type MemorySearcher,
} from '@neuronai/memory-engine';

export interface LocalFileSnapshot {
  version: 1;
  memories: MemoryRecord[];
  versions: MemoryVersionRecord[];
  relations: MemoryRelationRecord[];
}

export interface LocalFileMemoryStack {
  engine: MemoryEngine;
  memories: InMemoryMemoryRepository;
  versions: InMemoryMemoryVersionRepository;
  relations: InMemoryMemoryRelationRepository;
  runtimeDir: string;
  storePath: string;
  snapshot: LocalFileSnapshot;
  brain: ProjectBrain;
  projectRoot: string;
  persist: () => Promise<{ duplicatesRemoved: number }>;
  setSearcher: (searcher: MemorySearcher) => void;
}

function emptySnapshot(): LocalFileSnapshot {
  return { version: 1, memories: [], versions: [], relations: [] };
}

async function loadSnapshot(storePath: string): Promise<LocalFileSnapshot> {
  try {
    const raw = JSON.parse(await readFile(storePath, 'utf8')) as Partial<LocalFileSnapshot>;
    return {
      version: 1,
      memories: raw.memories ?? [],
      versions: raw.versions ?? [],
      relations: raw.relations ?? [],
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
 * Regenerable runtime store under `.neuron/runtime/`.
 * Curated knowledge is projected into ProjectBrain on every persist.
 */
export async function createLocalFileMemoryStack(
  projectRoot: string,
  searcher?: MemorySearcher,
): Promise<LocalFileMemoryStack> {
  const brain = await openProjectBrain(projectRoot);
  const paths = resolveBrainPaths(projectRoot);
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
      search: (input) =>
        activeSearcher ? activeSearcher.search(input) : Promise.resolve({ results: [] }),
    },
  });

  const persist = async (): Promise<{ duplicatesRemoved: number }> => {
    const next: LocalFileSnapshot = {
      version: 1,
      memories: memories.exportRecords(),
      versions: versions.exportRecords(),
      relations: relations.exportRecords(),
    };
    snapshot.memories = next.memories;
    snapshot.versions = next.versions;
    snapshot.relations = next.relations;

    const tmp = `${storePath}.tmp`;
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(tmp, storePath);

    return brain.learn(next.memories);
  };

  return {
    engine,
    memories,
    versions,
    relations,
    runtimeDir: paths.runtimeDir,
    storePath,
    snapshot,
    brain,
    projectRoot,
    persist,
    setSearcher: (next) => {
      activeSearcher = next;
    },
  };
}

import type {
  MemoryRecord,
  MemoryRelationRecord,
  MemoryVersionRecord,
} from '@neuron-ai-memory/types';

import {
  DefaultImportanceCalculator,
  type ImportanceCalculator,
} from './domain/services/importance-calculator.js';
import { MemoryValidator } from './domain/services/memory-validator.js';
import { InMemoryEventPublisher, type EventPublisher } from './domain/events/index.js';
import type {
  MemoryRepository,
  MemoryVersionRepository,
  MemoryRelationRepository,
} from './domain/repositories/index.js';
import {
  InMemoryMemoryRelationRepository,
  InMemoryMemoryRepository,
  InMemoryMemoryVersionRepository,
} from './infrastructure/in-memory/index.js';
import {
  ArchiveMemory,
  CreateMemory,
  CreateMemoryVersion,
  CreateRelation,
  GetMemory,
  GetProjectMemoryContext,
  SearchMemory,
  UpdateMemory,
  type CreateMemoryInput,
  type CreateMemoryVersionInput,
  type CreateRelationInput,
  type GetProjectMemoryContextInput,
  type GetProjectMemoryContextResult,
  type MemorySearcher,
  type SearchMemoryInput,
  type SearchMemoryResult,
  type UpdateMemoryInput,
} from './use-cases/index.js';

export interface MemoryEngineDeps {
  memories: MemoryRepository;
  versions: MemoryVersionRepository;
  relations: MemoryRelationRepository;
  calculator?: ImportanceCalculator;
  events?: EventPublisher;
  searcher?: MemorySearcher;
}

export interface MemoryEngine {
  createMemory(input: CreateMemoryInput): Promise<MemoryRecord>;
  getMemory(id: string): Promise<MemoryRecord>;
  searchMemory(input: SearchMemoryInput): Promise<SearchMemoryResult>;
  updateMemory(input: UpdateMemoryInput): Promise<MemoryRecord>;
  archiveMemory(id: string): Promise<void>;
  createMemoryVersion(input: CreateMemoryVersionInput): Promise<MemoryVersionRecord>;
  createRelation(input: CreateRelationInput): Promise<MemoryRelationRecord>;
  getProjectMemoryContext(
    input: GetProjectMemoryContextInput,
  ): Promise<GetProjectMemoryContextResult>;
}

export function createMemoryEngine(deps: MemoryEngineDeps): MemoryEngine {
  const calculator = deps.calculator ?? new DefaultImportanceCalculator();
  const events = deps.events ?? new InMemoryEventPublisher();
  const validator = new MemoryValidator(deps.memories);

  const createMemory = new CreateMemory(
    deps.memories,
    deps.versions,
    calculator,
    validator,
    events,
  );
  const getMemory = new GetMemory(deps.memories);
  const searchMemory = new SearchMemory(deps.searcher);
  const updateMemory = new UpdateMemory(deps.memories, deps.versions, events);
  const archiveMemory = new ArchiveMemory(deps.memories, events);
  const createMemoryVersion = new CreateMemoryVersion(deps.memories, deps.versions, events);
  const createRelation = new CreateRelation(deps.memories, deps.relations, events);
  const getProjectMemoryContext = new GetProjectMemoryContext(deps.memories);

  return {
    createMemory: (input) => createMemory.execute(input),
    getMemory: (id) => getMemory.execute(id),
    searchMemory: (input) => searchMemory.execute(input),
    updateMemory: (input) => updateMemory.execute(input),
    archiveMemory: (id) => archiveMemory.execute(id),
    createMemoryVersion: (input) => createMemoryVersion.execute(input),
    createRelation: (input) => createRelation.execute(input),
    getProjectMemoryContext: (input) => getProjectMemoryContext.execute(input),
  };
}

/** Convenience factory for tests and local experiments (no database). */
export function createInMemoryMemoryEngine(
  options: {
    events?: EventPublisher;
    calculator?: ImportanceCalculator;
    searcher?: MemorySearcher;
  } = {},
): MemoryEngine & {
  memories: InMemoryMemoryRepository;
  versions: InMemoryMemoryVersionRepository;
  relations: InMemoryMemoryRelationRepository;
} {
  const memories = new InMemoryMemoryRepository();
  const versions = new InMemoryMemoryVersionRepository();
  const relations = new InMemoryMemoryRelationRepository();
  const engine = createMemoryEngine({
    memories,
    versions,
    relations,
    events: options.events,
    calculator: options.calculator,
    searcher: options.searcher,
  });
  return Object.assign(engine, { memories, versions, relations });
}

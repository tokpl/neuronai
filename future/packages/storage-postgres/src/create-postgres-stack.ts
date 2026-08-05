import { createMemoryEngine, type MemoryEngine } from '@neuron-ai-memory/memory-engine';

import { createDbClient, type CreateDbClientOptions, type DatabaseClient } from './client/db.js';
import { PostgresMemoryRelationRepository } from './repositories/postgres-memory-relation-repository.js';
import { PostgresMemoryRepository } from './repositories/postgres-memory-repository.js';
import { PostgresMemoryVersionRepository } from './repositories/postgres-memory-version-repository.js';
import { PostgresProjectRepository } from './repositories/postgres-project-repository.js';

export interface PostgresMemoryStack {
  client: DatabaseClient;
  engine: MemoryEngine;
  projects: PostgresProjectRepository;
}

export function createPostgresMemoryStack(
  options: CreateDbClientOptions = {},
): PostgresMemoryStack {
  const client = createDbClient(options);
  const memories = new PostgresMemoryRepository(client.db);
  const versions = new PostgresMemoryVersionRepository(client.db);
  const relations = new PostgresMemoryRelationRepository(client.db);
  const projects = new PostgresProjectRepository(client.db);
  const engine = createMemoryEngine({ memories, versions, relations });
  return { client, engine, projects };
}

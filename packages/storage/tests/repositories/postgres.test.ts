import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createDbClient } from '../../src/client/db.js';
import { createPostgresMemoryStack } from '../../src/create-postgres-stack.js';

const runDb = process.env['NEURON_RUN_DB_TESTS'] === '1' && Boolean(process.env['DATABASE_URL']);

describe.skipIf(!runDb)('postgres repositories', () => {
  it('persists memory create/read/update', async () => {
    const stack = createPostgresMemoryStack();
    try {
      await stack.client.ping();
      const project = await stack.projects.upsert({
        slug: `test-${randomUUID().slice(0, 8)}`,
        name: 'Test Project',
      });

      const created = await stack.engine.createMemory({
        projectId: project.id,
        type: 'architecture_decision',
        title: 'Use Postgres',
        content: 'Relational integrity matters for memory versions.',
        source: 'manual',
      });

      const loaded = await stack.engine.getMemory(created.id);
      expect(loaded.title).toBe('Use Postgres');

      const updated = await stack.engine.updateMemory({
        id: created.id,
        content: 'Relational integrity + pgvector later.',
        reason: 'clarify embeddings plan',
      });
      expect(updated.version).toBe(2);
    } finally {
      await stack.client.close();
    }
  });
});

describe('storage client helpers', () => {
  it('requireDatabaseUrl throws when unset', async () => {
    const previous = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    const { requireDatabaseUrl } = await import('../../src/client/db.js');
    expect(() => requireDatabaseUrl()).toThrow(/DATABASE_URL/);
    if (previous !== undefined) process.env['DATABASE_URL'] = previous;
  });

  it('createDbClient is constructible when DATABASE_URL is set', () => {
    if (!process.env['DATABASE_URL']) {
      process.env['DATABASE_URL'] = 'postgresql://neuron:neuron@localhost:5432/neuron';
    }
    const client = createDbClient();
    expect(client.db).toBeDefined();
    void client.close();
  });
});

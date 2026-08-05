import { eq } from 'drizzle-orm';

import type { ProjectRecord } from '@neuron-ai-memory/types';
import { StorageError } from '@neuron-ai-memory/types';

import type { NeuronDatabase } from '../client/db.js';
import { projects } from '../schema/index.js';

export class PostgresProjectRepository {
  constructor(private readonly db: NeuronDatabase) {}

  async upsert(input: {
    id?: string;
    slug: string;
    name: string;
    type?: string;
    stack?: string[];
  }): Promise<ProjectRecord> {
    const existing = await this.db
      .select()
      .from(projects)
      .where(eq(projects.slug, input.slug))
      .limit(1);

    if (existing[0]) {
      const row = existing[0];
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        type: row.type,
        stack: row.stack ?? [],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    const inserted = await this.db
      .insert(projects)
      .values({
        id: input.id,
        slug: input.slug,
        name: input.name,
        type: input.type ?? 'application',
        stack: input.stack ?? [],
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      throw new StorageError('Failed to insert project');
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      stack: row.stack ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      stack: row.stack ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

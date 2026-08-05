import { asc, eq } from 'drizzle-orm';

import { MemoryVersion, type MemoryVersionRepository } from '@neuron-ai-memory/memory-engine';

import type { NeuronDatabase } from '../client/db.js';
import { memoryVersions } from '../schema/index.js';

export class PostgresMemoryVersionRepository implements MemoryVersionRepository {
  constructor(private readonly db: NeuronDatabase) {}

  async save(version: MemoryVersion): Promise<void> {
    const record = version.toRecord();
    await this.db.insert(memoryVersions).values({
      id: record.id,
      memoryId: record.memoryId,
      version: record.version,
      title: record.title,
      content: record.content,
      reason: record.reason,
      createdBy: record.createdBy,
      createdAt: new Date(record.createdAt),
    });
  }

  async listByMemoryId(memoryId: string): Promise<MemoryVersion[]> {
    const rows = await this.db
      .select()
      .from(memoryVersions)
      .where(eq(memoryVersions.memoryId, memoryId))
      .orderBy(asc(memoryVersions.version));

    return rows.map((row) =>
      MemoryVersion.fromRecord({
        id: row.id,
        memoryId: row.memoryId,
        version: row.version,
        title: row.title,
        content: row.content,
        reason: row.reason,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }
}

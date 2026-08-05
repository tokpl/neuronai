import { eq, or } from 'drizzle-orm';

import { MemoryRelation, type MemoryRelationRepository } from '@neuron-ai-memory/memory-engine';

import type { NeuronDatabase } from '../client/db.js';
import { memoryRelations } from '../schema/index.js';

export class PostgresMemoryRelationRepository implements MemoryRelationRepository {
  constructor(private readonly db: NeuronDatabase) {}

  async save(relation: MemoryRelation): Promise<void> {
    const record = relation.toRecord();
    await this.db.insert(memoryRelations).values({
      id: record.id,
      projectId: record.projectId,
      fromMemoryId: record.fromMemoryId,
      toMemoryId: record.toMemoryId,
      relationType: record.relationType,
      metadata: record.metadata,
      createdAt: new Date(record.createdAt),
    });
  }

  async listByMemoryId(memoryId: string): Promise<MemoryRelation[]> {
    const rows = await this.db
      .select()
      .from(memoryRelations)
      .where(
        or(eq(memoryRelations.fromMemoryId, memoryId), eq(memoryRelations.toMemoryId, memoryId)),
      );

    return rows.map((row) =>
      MemoryRelation.fromRecord({
        id: row.id,
        projectId: row.projectId,
        fromMemoryId: row.fromMemoryId,
        toMemoryId: row.toMemoryId,
        relationType: row.relationType,
        metadata: row.metadata ?? {},
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }

  async listByProjectId(projectId: string): Promise<MemoryRelation[]> {
    const rows = await this.db
      .select()
      .from(memoryRelations)
      .where(eq(memoryRelations.projectId, projectId));

    return rows.map((row) =>
      MemoryRelation.fromRecord({
        id: row.id,
        projectId: row.projectId,
        fromMemoryId: row.fromMemoryId,
        toMemoryId: row.toMemoryId,
        relationType: row.relationType,
        metadata: row.metadata ?? {},
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }
}

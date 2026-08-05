import { and, desc, eq, sql } from 'drizzle-orm';

import type { FindMemoriesFilter, MemoryRepository } from '@neuron-ai-memory/memory-engine';
import { type Memory } from '@neuron-ai-memory/memory-engine';

import type { NeuronDatabase } from '../client/db.js';
import { memories } from '../schema/index.js';
import { memoryToRow, rowToMemory } from './mappers.js';

export class PostgresMemoryRepository implements MemoryRepository {
  constructor(private readonly db: NeuronDatabase) {}

  async save(memory: Memory): Promise<void> {
    await this.db.insert(memories).values(memoryToRow(memory));
  }

  async update(memory: Memory): Promise<void> {
    const row = memoryToRow(memory);
    await this.db
      .update(memories)
      .set({
        title: row.title,
        content: row.content,
        importanceScore: row.importanceScore,
        confidenceScore: row.confidenceScore,
        freshnessScore: row.freshnessScore,
        status: row.status,
        version: row.version,
        tags: row.tags,
        usageCount: row.usageCount,
        lastUsedAt: row.lastUsedAt,
        embeddingId: row.embeddingId,
        updatedAt: row.updatedAt,
      })
      .where(eq(memories.id, memory.id));
  }

  async findById(id: string): Promise<Memory | null> {
    const rows = await this.db.select().from(memories).where(eq(memories.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToMemory(row) : null;
  }

  async findByProject(filter: FindMemoriesFilter): Promise<Memory[]> {
    const conditions = [eq(memories.projectId, filter.projectId)];
    if (filter.status) conditions.push(eq(memories.status, filter.status));
    if (filter.type) conditions.push(eq(memories.type, filter.type));

    const rows = await this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.importanceScore))
      .limit(filter.limit ?? 100);

    return rows.map(rowToMemory);
  }

  async findDuplicate(projectId: string, title: string, content: string): Promise<Memory | null> {
    const rows = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.projectId, projectId),
          sql`lower(trim(${memories.title})) = lower(trim(${title}))`,
          sql`lower(trim(${memories.content})) = lower(trim(${content}))`,
          eq(memories.status, 'active'),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToMemory(row) : null;
  }
}

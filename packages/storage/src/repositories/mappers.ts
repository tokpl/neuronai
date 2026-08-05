import { Memory } from '@neuron-ai-memory/memory-engine';
import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { memories } from '../schema/index.js';

type MemoryRow = typeof memories.$inferSelect;

export function memoryToRow(memory: Memory): typeof memories.$inferInsert {
  const record = memory.toRecord();
  return {
    id: record.id,
    projectId: record.projectId,
    type: record.type,
    title: record.title,
    content: record.content,
    importanceScore: record.importanceScore,
    confidenceScore: record.confidenceScore,
    freshnessScore: record.freshnessScore,
    source: record.source,
    status: record.status,
    version: record.version,
    tags: record.tags,
    usageCount: record.usageCount,
    lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
    embeddingId: record.embeddingId,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function rowToMemory(row: MemoryRow): Memory {
  const record: MemoryRecord = {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    title: row.title,
    content: row.content,
    importanceScore: row.importanceScore,
    confidenceScore: row.confidenceScore,
    freshnessScore: row.freshnessScore,
    source: row.source,
    status: row.status,
    version: row.version,
    tags: row.tags ?? [],
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    embeddingId: row.embeddingId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  return Memory.fromRecord(record);
}

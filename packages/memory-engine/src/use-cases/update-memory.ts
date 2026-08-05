import { randomUUID } from 'node:crypto';

import { NotFoundError, type MemoryRecord } from '@neuronai/types';

import { MemoryVersion } from '../domain/entities/index.js';
import type { EventPublisher } from '../domain/events/index.js';
import type { MemoryRepository, MemoryVersionRepository } from '../domain/repositories/index.js';
import { ConfidenceScore, MemoryImportance, MemorySource } from '../domain/value-objects/index.js';

export interface UpdateMemoryInput {
  id: string;
  title?: string;
  content?: string;
  reason: string;
  tags?: string[];
  importanceScore?: number;
  confidenceScore?: number;
  updatedBy?: string;
}

export class UpdateMemory {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly versions: MemoryVersionRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(input: UpdateMemoryInput): Promise<MemoryRecord> {
    const memory = await this.memories.findById(input.id);
    if (!memory) {
      throw new NotFoundError(`Memory not found: ${input.id}`, { id: input.id });
    }

    const previousVersion = memory.version;

    memory.applyUpdate({
      title: input.title,
      content: input.content,
      tags: input.tags,
      importance:
        input.importanceScore !== undefined
          ? MemoryImportance.create(input.importanceScore)
          : undefined,
      confidence:
        input.confidenceScore !== undefined
          ? ConfidenceScore.create(input.confidenceScore)
          : undefined,
    });

    await this.memories.update(memory);

    const newVersion = MemoryVersion.create({
      id: randomUUID(),
      memoryId: memory.id,
      version: memory.version,
      title: memory.title,
      content: memory.content,
      reason: input.reason,
      createdBy: MemorySource.create(input.updatedBy ?? memory.source.value),
    });
    await this.versions.save(newVersion);

    await this.events.publish({
      name: 'memory.updated',
      occurredAt: new Date().toISOString(),
      payload: { memory: memory.toRecord(), previousVersion },
    });

    return memory.toRecord();
  }
}

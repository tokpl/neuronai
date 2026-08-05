import { randomUUID } from 'node:crypto';

import {
  NotFoundError,
  type MemoryVersionRecord,
  type MemorySource as MemorySourceValue,
} from '@neuron-ai-memory/types';

import { MemoryVersion } from '../domain/entities/index.js';
import type { EventPublisher } from '../domain/events/index.js';
import type { MemoryRepository, MemoryVersionRepository } from '../domain/repositories/index.js';
import { MemorySource } from '../domain/value-objects/index.js';

export interface CreateMemoryVersionInput {
  memoryId: string;
  title?: string;
  content: string;
  reason: string;
  createdBy?: MemorySourceValue;
}

/**
 * Creates an explicit new version and advances the memory head.
 */
export class CreateMemoryVersion {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly versions: MemoryVersionRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(input: CreateMemoryVersionInput): Promise<MemoryVersionRecord> {
    const memory = await this.memories.findById(input.memoryId);
    if (!memory) {
      throw new NotFoundError(`Memory not found: ${input.memoryId}`, {
        id: input.memoryId,
      });
    }

    memory.applyUpdate({
      title: input.title,
      content: input.content,
    });
    await this.memories.update(memory);

    const version = MemoryVersion.create({
      id: randomUUID(),
      memoryId: memory.id,
      version: memory.version,
      title: memory.title,
      content: memory.content,
      reason: input.reason,
      createdBy: MemorySource.create(input.createdBy ?? memory.source.value),
    });
    await this.versions.save(version);

    await this.events.publish({
      name: 'memory.version_created',
      occurredAt: new Date().toISOString(),
      payload: { memory: memory.toRecord() },
    });

    return version.toRecord();
  }
}

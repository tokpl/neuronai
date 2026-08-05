import { randomUUID } from 'node:crypto';

import type { MemoryRecord, MemorySource as MemorySourceValue } from '@neuronai/types';

import { Memory, MemoryVersion } from '../domain/entities/index.js';
import type { EventPublisher } from '../domain/events/index.js';
import type { MemoryRepository, MemoryVersionRepository } from '../domain/repositories/index.js';
import type { ImportanceCalculator } from '../domain/services/importance-calculator.js';
import { type MemoryValidator } from '../domain/services/memory-validator.js';
import {
  ConfidenceScore,
  MemoryImportance,
  MemorySource,
  MemoryType,
} from '../domain/value-objects/index.js';

export interface CreateMemoryInput {
  projectId: string;
  type: string;
  title: string;
  content: string;
  source?: MemorySourceValue;
  tags?: string[];
  manualImportance?: number;
  confidence?: number;
}

export class CreateMemory {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly versions: MemoryVersionRepository,
    private readonly calculator: ImportanceCalculator,
    private readonly validator: MemoryValidator,
    private readonly events: EventPublisher,
  ) {}

  async execute(input: CreateMemoryInput): Promise<MemoryRecord> {
    await this.validator.assertCanCreate(input);

    const type = MemoryType.create(input.type);
    const source = MemorySource.create(input.source ?? 'manual');
    const importance = MemoryImportance.create(
      this.calculator.calculate({
        type: type.value,
        contentLength: input.content.trim().length,
        source: source.value,
        manualImportance: input.manualImportance,
      }),
    );
    const confidence = ConfidenceScore.create(input.confidence ?? 0.7);

    const memory = Memory.create({
      id: randomUUID(),
      projectId: input.projectId,
      type,
      title: input.title,
      content: input.content,
      importance,
      confidence,
      source,
      tags: input.tags ?? [],
    });

    await this.memories.save(memory);

    const version = MemoryVersion.create({
      id: randomUUID(),
      memoryId: memory.id,
      version: memory.version,
      title: memory.title,
      content: memory.content,
      reason: 'initial version',
      createdBy: source,
    });
    await this.versions.save(version);

    await this.events.publish({
      name: 'memory.created',
      occurredAt: new Date().toISOString(),
      payload: { memory: memory.toRecord() },
    });

    return memory.toRecord();
  }
}

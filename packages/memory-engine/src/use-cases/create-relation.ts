import { randomUUID } from 'node:crypto';

import {
  NotFoundError,
  type MemoryRelationRecord,
  type RelationType as RelationTypeValue,
} from '@neuronai/types';

import { MemoryRelation } from '../domain/entities/index.js';
import type { EventPublisher } from '../domain/events/index.js';
import type { MemoryRelationRepository, MemoryRepository } from '../domain/repositories/index.js';
import { RelationType } from '../domain/value-objects/index.js';

export interface CreateRelationInput {
  projectId: string;
  fromMemoryId: string;
  toMemoryId: string;
  relationType: RelationTypeValue | string;
  metadata?: Record<string, unknown>;
}

export class CreateRelation {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly relations: MemoryRelationRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(input: CreateRelationInput): Promise<MemoryRelationRecord> {
    const from = await this.memories.findById(input.fromMemoryId);
    const to = await this.memories.findById(input.toMemoryId);
    if (!from || !to) {
      throw new NotFoundError('Both memories must exist to create a relation', {
        fromMemoryId: input.fromMemoryId,
        toMemoryId: input.toMemoryId,
      });
    }
    if (from.projectId !== input.projectId || to.projectId !== input.projectId) {
      throw new NotFoundError('Memories must belong to the given project', {
        projectId: input.projectId,
      });
    }

    const relation = MemoryRelation.create({
      id: randomUUID(),
      projectId: input.projectId,
      fromMemoryId: input.fromMemoryId,
      toMemoryId: input.toMemoryId,
      relationType: RelationType.create(input.relationType),
      metadata: input.metadata,
    });

    await this.relations.save(relation);
    await this.events.publish({
      name: 'memory.relation_created',
      occurredAt: new Date().toISOString(),
      payload: { relation: relation.toRecord() },
    });

    return relation.toRecord();
  }
}

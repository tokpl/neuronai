import type { MemoryRelationRecord } from '@neuron-ai-memory/types';
import { ValidationError } from '@neuron-ai-memory/types';

import { RelationType } from '../value-objects/index.js';

export interface CreateMemoryRelationProps {
  id: string;
  projectId: string;
  fromMemoryId: string;
  toMemoryId: string;
  relationType: RelationType;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export class MemoryRelation {
  readonly id: string;
  readonly projectId: string;
  readonly fromMemoryId: string;
  readonly toMemoryId: string;
  readonly relationType: RelationType;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;

  private constructor(props: CreateMemoryRelationProps) {
    if (!props.projectId.trim()) {
      throw new ValidationError('projectId is required');
    }
    if (!props.fromMemoryId.trim() || !props.toMemoryId.trim()) {
      throw new ValidationError('fromMemoryId and toMemoryId are required');
    }
    if (props.fromMemoryId === props.toMemoryId) {
      throw new ValidationError('a memory cannot relate to itself');
    }

    this.id = props.id;
    this.projectId = props.projectId;
    this.fromMemoryId = props.fromMemoryId;
    this.toMemoryId = props.toMemoryId;
    this.relationType = props.relationType;
    this.metadata = props.metadata ?? {};
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: CreateMemoryRelationProps): MemoryRelation {
    return new MemoryRelation(props);
  }

  toRecord(): MemoryRelationRecord {
    return {
      id: this.id,
      projectId: this.projectId,
      fromMemoryId: this.fromMemoryId,
      toMemoryId: this.toMemoryId,
      relationType: this.relationType.value,
      metadata: { ...this.metadata },
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromRecord(record: MemoryRelationRecord): MemoryRelation {
    return new MemoryRelation({
      id: record.id,
      projectId: record.projectId,
      fromMemoryId: record.fromMemoryId,
      toMemoryId: record.toMemoryId,
      relationType: RelationType.create(record.relationType),
      metadata: record.metadata,
      createdAt: new Date(record.createdAt),
    });
  }
}

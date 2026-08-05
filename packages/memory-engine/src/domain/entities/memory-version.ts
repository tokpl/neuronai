import type { MemoryVersionRecord } from '@neuronai/types';
import { ValidationError } from '@neuronai/types';

import { MemorySource } from '../value-objects/index.js';

export interface CreateMemoryVersionProps {
  id: string;
  memoryId: string;
  version: number;
  title: string;
  content: string;
  reason: string;
  createdBy: MemorySource;
  createdAt?: Date;
}

export class MemoryVersion {
  readonly id: string;
  readonly memoryId: string;
  readonly version: number;
  readonly title: string;
  readonly content: string;
  readonly reason: string;
  readonly createdBy: MemorySource;
  readonly createdAt: Date;

  private constructor(props: CreateMemoryVersionProps) {
    if (!props.memoryId.trim()) {
      throw new ValidationError('memoryId is required');
    }
    if (props.version < 1) {
      throw new ValidationError('version must be >= 1');
    }
    if (!props.content.trim()) {
      throw new ValidationError('version content must not be empty');
    }
    if (!props.reason.trim()) {
      throw new ValidationError('version reason must not be empty');
    }

    this.id = props.id;
    this.memoryId = props.memoryId;
    this.version = props.version;
    this.title = props.title.trim();
    this.content = props.content.trim();
    this.reason = props.reason.trim();
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: CreateMemoryVersionProps): MemoryVersion {
    return new MemoryVersion(props);
  }

  toRecord(): MemoryVersionRecord {
    return {
      id: this.id,
      memoryId: this.memoryId,
      version: this.version,
      title: this.title,
      content: this.content,
      reason: this.reason,
      createdAt: this.createdAt.toISOString(),
      createdBy: this.createdBy.value,
    };
  }

  static fromRecord(record: MemoryVersionRecord): MemoryVersion {
    return new MemoryVersion({
      id: record.id,
      memoryId: record.memoryId,
      version: record.version,
      title: record.title,
      content: record.content,
      reason: record.reason,
      createdBy: MemorySource.create(record.createdBy),
      createdAt: new Date(record.createdAt),
    });
  }
}

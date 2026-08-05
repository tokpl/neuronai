import type { MemoryRecord } from '@neuronai/types';
import { ValidationError } from '@neuronai/types';

import {
  ConfidenceScore,
  MemoryImportance,
  MemorySource,
  MemoryStatus,
  MemoryType,
} from '../value-objects/index.js';

export interface CreateMemoryProps {
  id: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  importance: MemoryImportance;
  confidence: ConfidenceScore;
  freshnessScore?: number;
  source: MemorySource;
  status?: MemoryStatus;
  version?: number;
  tags?: string[];
  usageCount?: number;
  lastUsedAt?: Date | null;
  embeddingId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Memory {
  readonly id: string;
  readonly projectId: string;
  readonly type: MemoryType;
  private _title: string;
  private _content: string;
  private _importance: MemoryImportance;
  private _confidence: ConfidenceScore;
  private _freshnessScore: number;
  readonly source: MemorySource;
  private _status: MemoryStatus;
  private _version: number;
  private _tags: string[];
  private _usageCount: number;
  private _lastUsedAt: Date | null;
  private _embeddingId: string | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateMemoryProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.type = props.type;
    this._title = props.title.trim();
    this._content = props.content.trim();
    this._importance = props.importance;
    this._confidence = props.confidence;
    this._freshnessScore = props.freshnessScore ?? 1;
    this.source = props.source;
    this._status = props.status ?? MemoryStatus.active();
    this._version = props.version ?? 1;
    this._tags = props.tags ?? [];
    this._usageCount = props.usageCount ?? 0;
    this._lastUsedAt = props.lastUsedAt ?? null;
    this._embeddingId = props.embeddingId ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? this.createdAt;

    if (!this.projectId.trim()) {
      throw new ValidationError('projectId is required');
    }
    if (!this._title) {
      throw new ValidationError('title must not be empty');
    }
    if (!this._content) {
      throw new ValidationError('content must not be empty');
    }
  }

  static create(props: CreateMemoryProps): Memory {
    return new Memory(props);
  }

  get title(): string {
    return this._title;
  }

  get content(): string {
    return this._content;
  }

  get importance(): MemoryImportance {
    return this._importance;
  }

  get confidence(): ConfidenceScore {
    return this._confidence;
  }

  get freshnessScore(): number {
    return this._freshnessScore;
  }

  get status(): MemoryStatus {
    return this._status;
  }

  get version(): number {
    return this._version;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  get usageCount(): number {
    return this._usageCount;
  }

  get lastUsedAt(): Date | null {
    return this._lastUsedAt;
  }

  get embeddingId(): string | null {
    return this._embeddingId;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  applyUpdate(input: {
    title?: string;
    content?: string;
    importance?: MemoryImportance;
    confidence?: ConfidenceScore;
    tags?: string[];
  }): void {
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new ValidationError('title must not be empty');
      this._title = title;
    }
    if (input.content !== undefined) {
      const content = input.content.trim();
      if (!content) throw new ValidationError('content must not be empty');
      this._content = content;
    }
    if (input.importance) this._importance = input.importance;
    if (input.confidence) this._confidence = input.confidence;
    if (input.tags) this._tags = [...input.tags];
    this._version += 1;
    this._updatedAt = new Date();
    this._freshnessScore = 1;
  }

  archive(): void {
    if (this._status.value === 'archived') {
      return;
    }
    this._status = MemoryStatus.archived();
    this._updatedAt = new Date();
  }

  supersede(): void {
    this._status = MemoryStatus.superseded();
    this._updatedAt = new Date();
  }

  markUsed(at: Date = new Date()): void {
    this._usageCount += 1;
    this._lastUsedAt = at;
    this._updatedAt = at;
  }

  toRecord(): MemoryRecord {
    return {
      id: this.id,
      projectId: this.projectId,
      type: this.type.value,
      title: this._title,
      content: this._content,
      importanceScore: this._importance.value,
      confidenceScore: this._confidence.value,
      freshnessScore: this._freshnessScore,
      source: this.source.value,
      status: this._status.value,
      version: this._version,
      tags: [...this._tags],
      usageCount: this._usageCount,
      lastUsedAt: this._lastUsedAt?.toISOString() ?? null,
      embeddingId: this._embeddingId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  static fromRecord(record: MemoryRecord): Memory {
    return new Memory({
      id: record.id,
      projectId: record.projectId,
      type: MemoryType.create(record.type),
      title: record.title,
      content: record.content,
      importance: MemoryImportance.create(record.importanceScore),
      confidence: ConfidenceScore.create(record.confidenceScore),
      freshnessScore: record.freshnessScore,
      source: MemorySource.create(record.source),
      status: MemoryStatus.create(record.status),
      version: record.version,
      tags: record.tags,
      usageCount: record.usageCount,
      lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
      embeddingId: record.embeddingId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }
}

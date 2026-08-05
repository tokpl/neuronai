import type { MemoryRelationRecord } from '@neuronai/types';

import { MemoryRelation } from '../../domain/entities/memory-relation.js';
import type { MemoryRelationRepository } from '../../domain/repositories/memory-relation-repository.js';

export class InMemoryMemoryRelationRepository implements MemoryRelationRepository {
  private readonly items: MemoryRelation[] = [];

  async save(relation: MemoryRelation): Promise<void> {
    this.items.push(relation);
  }

  async listByMemoryId(memoryId: string): Promise<MemoryRelation[]> {
    return this.items.filter((r) => r.fromMemoryId === memoryId || r.toMemoryId === memoryId);
  }

  async listByProjectId(projectId: string): Promise<MemoryRelation[]> {
    return this.items.filter((r) => r.projectId === projectId);
  }

  exportRecords(): MemoryRelationRecord[] {
    return this.items.map((r) => r.toRecord());
  }

  importRecords(records: MemoryRelationRecord[]): void {
    for (const record of records) {
      this.items.push(MemoryRelation.fromRecord(record));
    }
  }
}

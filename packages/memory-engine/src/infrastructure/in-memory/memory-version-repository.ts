import type { MemoryVersionRecord } from '@neuronai/types';

import { MemoryVersion } from '../../domain/entities/memory-version.js';
import type { MemoryVersionRepository } from '../../domain/repositories/memory-version-repository.js';

export class InMemoryMemoryVersionRepository implements MemoryVersionRepository {
  private readonly items: MemoryVersion[] = [];

  async save(version: MemoryVersion): Promise<void> {
    this.items.push(version);
  }

  async listByMemoryId(memoryId: string): Promise<MemoryVersion[]> {
    return this.items.filter((v) => v.memoryId === memoryId).sort((a, b) => a.version - b.version);
  }

  exportRecords(): MemoryVersionRecord[] {
    return this.items.map((v) => v.toRecord());
  }

  importRecords(records: MemoryVersionRecord[]): void {
    for (const record of records) {
      this.items.push(MemoryVersion.fromRecord(record));
    }
  }
}

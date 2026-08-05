import type { MemoryRecord } from '@neuronai/types';

import { Memory } from '../../domain/entities/memory.js';
import type {
  FindMemoriesFilter,
  MemoryRepository,
} from '../../domain/repositories/memory-repository.js';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly items = new Map<string, Memory>();

  async save(memory: Memory): Promise<void> {
    this.items.set(memory.id, memory);
  }

  async update(memory: Memory): Promise<void> {
    this.items.set(memory.id, memory);
  }

  async findById(id: string): Promise<Memory | null> {
    return this.items.get(id) ?? null;
  }

  async findByProject(filter: FindMemoriesFilter): Promise<Memory[]> {
    const all = [...this.items.values()].filter((m) => m.projectId === filter.projectId);
    const filtered = all.filter((m) => {
      if (filter.status && m.status.value !== filter.status) return false;
      if (filter.type && m.type.value !== filter.type) return false;
      return true;
    });
    return filtered.slice(0, filter.limit ?? filtered.length);
  }

  async findDuplicate(projectId: string, title: string, content: string): Promise<Memory | null> {
    const titleKey = normalize(title);
    const contentKey = normalize(content);
    for (const memory of this.items.values()) {
      if (memory.projectId !== projectId) continue;
      if (memory.status.value === 'archived') continue;
      if (normalize(memory.title) === titleKey && normalize(memory.content) === contentKey) {
        return memory;
      }
    }
    return null;
  }

  exportRecords(): MemoryRecord[] {
    return [...this.items.values()].map((m) => m.toRecord());
  }

  importRecords(records: MemoryRecord[]): void {
    for (const record of records) {
      this.items.set(record.id, Memory.fromRecord(record));
    }
  }
}

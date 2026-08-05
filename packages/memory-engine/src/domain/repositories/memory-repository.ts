import type { MemoryType } from '@neuron-ai-memory/types';

import type { Memory } from '../entities/memory.js';

export interface FindMemoriesFilter {
  projectId: string;
  status?: 'active' | 'archived' | 'superseded';
  type?: MemoryType;
  limit?: number;
}

export interface MemoryRepository {
  save(memory: Memory): Promise<void>;
  update(memory: Memory): Promise<void>;
  findById(id: string): Promise<Memory | null>;
  findByProject(filter: FindMemoriesFilter): Promise<Memory[]>;
  findDuplicate(projectId: string, title: string, content: string): Promise<Memory | null>;
}

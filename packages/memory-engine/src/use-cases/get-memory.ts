import { NotFoundError, type MemoryRecord } from '@neuronai/types';

import type { MemoryRepository } from '../domain/repositories/index.js';

export class GetMemory {
  constructor(private readonly memories: MemoryRepository) {}

  async execute(id: string): Promise<MemoryRecord> {
    const memory = await this.memories.findById(id);
    if (!memory) {
      throw new NotFoundError(`Memory not found: ${id}`, { id });
    }
    return memory.toRecord();
  }
}

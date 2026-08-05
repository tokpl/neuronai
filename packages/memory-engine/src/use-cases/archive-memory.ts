import { NotFoundError } from '@neuron-ai-memory/types';

import type { EventPublisher } from '../domain/events/index.js';
import type { MemoryRepository } from '../domain/repositories/index.js';

export class ArchiveMemory {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(id: string): Promise<void> {
    const memory = await this.memories.findById(id);
    if (!memory) {
      throw new NotFoundError(`Memory not found: ${id}`, { id });
    }
    memory.archive();
    await this.memories.update(memory);
    await this.events.publish({
      name: 'memory.archived',
      occurredAt: new Date().toISOString(),
      payload: { memoryId: memory.id, projectId: memory.projectId },
    });
  }
}

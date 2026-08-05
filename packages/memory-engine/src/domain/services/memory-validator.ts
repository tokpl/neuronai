import { ValidationError } from '@neuronai/types';

import type { MemoryRepository } from '../repositories/memory-repository.js';
import { MemoryType } from '../value-objects/memory-type.js';

export interface ValidateCreateMemoryInput {
  projectId: string;
  type: string;
  title: string;
  content: string;
}

export class MemoryValidator {
  constructor(private readonly memories: MemoryRepository) {}

  async assertCanCreate(input: ValidateCreateMemoryInput): Promise<void> {
    if (!input.projectId?.trim()) {
      throw new ValidationError('projectId is required');
    }
    MemoryType.create(input.type);
    if (!input.title?.trim()) {
      throw new ValidationError('title must not be empty');
    }
    if (!input.content?.trim()) {
      throw new ValidationError('content must not be empty');
    }

    const duplicate = await this.memories.findDuplicate(
      input.projectId,
      input.title.trim(),
      input.content.trim(),
    );
    if (duplicate) {
      throw new ValidationError('duplicate memory detected', {
        existingId: duplicate.id,
      });
    }
  }
}

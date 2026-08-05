import { ValidationError } from '@neuronai/types';
import type { MemoryStatus as MemoryStatusValue } from '@neuronai/types';

const VALUES = ['active', 'archived', 'superseded'] as const satisfies readonly MemoryStatusValue[];

export class MemoryStatus {
  private constructor(readonly value: MemoryStatusValue) {}

  static readonly values = VALUES;

  static create(raw: string): MemoryStatus {
    if (!(VALUES as readonly string[]).includes(raw)) {
      throw new ValidationError(`Invalid memory status: ${raw}`, {
        allowed: [...VALUES],
      });
    }
    return new MemoryStatus(raw as MemoryStatusValue);
  }

  static active(): MemoryStatus {
    return new MemoryStatus('active');
  }

  static archived(): MemoryStatus {
    return new MemoryStatus('archived');
  }

  static superseded(): MemoryStatus {
    return new MemoryStatus('superseded');
  }

  isActive(): boolean {
    return this.value === 'active';
  }
}

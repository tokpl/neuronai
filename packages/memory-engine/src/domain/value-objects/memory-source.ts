import { ValidationError } from '@neuronai/types';
import type { MemorySource as MemorySourceValue } from '@neuronai/types';

const VALUES = [
  'agent',
  'user',
  'git',
  'documentation',
  'manual',
] as const satisfies readonly MemorySourceValue[];

export class MemorySource {
  private constructor(readonly value: MemorySourceValue) {}

  static readonly values = VALUES;

  static create(raw: string): MemorySource {
    if (!(VALUES as readonly string[]).includes(raw)) {
      throw new ValidationError(`Invalid memory source: ${raw}`, {
        allowed: [...VALUES],
      });
    }
    return new MemorySource(raw as MemorySourceValue);
  }

  static manual(): MemorySource {
    return new MemorySource('manual');
  }
}

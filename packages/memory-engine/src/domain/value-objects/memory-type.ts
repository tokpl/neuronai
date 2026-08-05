import { ValidationError } from '@neuron-ai-memory/types';
import type { MemoryType as MemoryTypeValue } from '@neuron-ai-memory/types';

const VALUES = [
  'architecture_decision',
  'knowledge',
  'pattern',
  'mistake',
  'context',
  'business_rule',
  'dependency',
] as const satisfies readonly MemoryTypeValue[];

export class MemoryType {
  private constructor(readonly value: MemoryTypeValue) {}

  static readonly values = VALUES;

  static create(raw: string): MemoryType {
    if (!(VALUES as readonly string[]).includes(raw)) {
      throw new ValidationError(`Invalid memory type: ${raw}`, {
        allowed: [...VALUES],
      });
    }
    return new MemoryType(raw as MemoryTypeValue);
  }

  static architectureDecision(): MemoryType {
    return new MemoryType('architecture_decision');
  }

  equals(other: MemoryType): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

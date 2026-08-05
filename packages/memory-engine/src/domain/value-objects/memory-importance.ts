import { ValidationError } from '@neuron-ai-memory/types';

export class MemoryImportance {
  private constructor(readonly value: number) {}

  static create(raw: number): MemoryImportance {
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new ValidationError('importanceScore must be between 0 and 1', { raw });
    }
    return new MemoryImportance(Number(raw.toFixed(4)));
  }

  static defaultForType(typePrior: number): MemoryImportance {
    return MemoryImportance.create(typePrior);
  }
}

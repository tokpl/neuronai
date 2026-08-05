import { ValidationError } from '@neuronai/types';

export class ConfidenceScore {
  private constructor(readonly value: number) {}

  static create(raw: number): ConfidenceScore {
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new ValidationError('confidenceScore must be between 0 and 1', { raw });
    }
    return new ConfidenceScore(Number(raw.toFixed(4)));
  }

  static default(): ConfidenceScore {
    return new ConfidenceScore(0.7);
  }
}

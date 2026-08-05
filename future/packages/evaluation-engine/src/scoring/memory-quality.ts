import type { MemoryQualityScore } from '../types.js';
import { clamp01, round2 } from '../types.js';

export interface MemoryQualityInput {
  memoryId: string;
  title: string;
  confidence?: number;
  usageFrequency?: number;
  validationCount?: number;
  /** Days since last update — lower is fresher */
  ageDays?: number;
  healthScore?: number;
}

/**
 * MemoryQualityScore — confidence, usage, validation, freshness.
 */
export class MemoryQualityScorer {
  score(input: MemoryQualityInput): MemoryQualityScore {
    const confidence = clamp01(input.confidence ?? (input.healthScore ?? 70) / 100);
    const usageFrequency = clamp01((input.usageFrequency ?? 0) / 100);
    const validationCount = clamp01((input.validationCount ?? 0) / 20);
    const freshness = clamp01(1 - Math.min(365, input.ageDays ?? 30) / 365);
    const overall = round2(
      0.35 * confidence + 0.25 * usageFrequency + 0.2 * validationCount + 0.2 * freshness,
    );
    return {
      memoryId: input.memoryId,
      title: input.title,
      confidence: round2(confidence),
      usageFrequency: round2(usageFrequency),
      validationCount: round2(validationCount),
      freshness: round2(freshness),
      overall,
    };
  }

  scoreMany(inputs: MemoryQualityInput[]): MemoryQualityScore[] {
    return inputs.map((i) => this.score(i)).sort((a, b) => b.overall - a.overall);
  }
}

export function createMemoryQualityScorer(): MemoryQualityScorer {
  return new MemoryQualityScorer();
}

import type { MemoryQualitySample } from '../types.js';
import { MEMORY_QUALITY_SAMPLES } from '../datasets/memory-quality.js';
import type { MemoryQualityResult } from '../types.js';

/**
 * Heuristic classifier: should Neuron store this candidate?
 * Measures memory-layer quality gates — not an LLM.
 */
export class MemoryQualityEvaluator {
  classify(sample: Pick<MemoryQualitySample, 'title' | 'content'>): 'good' | 'bad' {
    const hay = `${sample.title} ${sample.content}`.toLowerCase();
    const badSignals =
      /\b(rename|variable|typo|console\.log|left-pad|bump package|patch version|todo:|wip)\b/.test(
        hay,
      ) || hay.length < 40;
    const goodSignals =
      /\b(decision|architecture|pattern|mistake|never|must|event sourcing|rbac|postgres|permission|outbox|ledger)\b/.test(
        hay,
      );
    if (badSignals && !goodSignals) return 'bad';
    if (goodSignals) return 'good';
    return hay.length > 80 ? 'good' : 'bad';
  }

  evaluate(samples: MemoryQualitySample[] = MEMORY_QUALITY_SAMPLES): MemoryQualityResult {
    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;
    for (const s of samples) {
      const pred = this.classify(s);
      if (pred === 'good' && s.label === 'good') tp += 1;
      else if (pred === 'bad' && s.label === 'bad') tn += 1;
      else if (pred === 'good' && s.label === 'bad') fp += 1;
      else fn += 1;
    }
    const total = samples.length || 1;
    return {
      samples: samples.length,
      accuracy: (tp + tn) / total,
      truePositives: tp,
      trueNegatives: tn,
      falsePositives: fp,
      falseNegatives: fn,
    };
  }
}

export function createMemoryQualityEvaluator(): MemoryQualityEvaluator {
  return new MemoryQualityEvaluator();
}

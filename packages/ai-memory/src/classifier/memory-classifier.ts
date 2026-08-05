import type { MemoryType } from '@neuronai/types';
import {
  heuristicClassify,
  type HeuristicLabel,
  type AIProvider,
} from '@neuronai/ai-provider';

export type ClassifierLabel =
  | 'ARCHITECTURE_DECISION'
  | 'KNOWLEDGE'
  | 'PATTERN'
  | 'MISTAKE'
  | 'CONTEXT'
  | 'BUSINESS_RULE'
  | 'DEPENDENCY'
  | 'IGNORE';

export interface ClassificationResult {
  label: ClassifierLabel;
  confidence: number;
  method: 'heuristic' | 'ai';
  memoryType: MemoryType | null;
}

const LABEL_TO_TYPE: Record<Exclude<ClassifierLabel, 'IGNORE'>, MemoryType> = {
  ARCHITECTURE_DECISION: 'architecture_decision',
  KNOWLEDGE: 'knowledge',
  PATTERN: 'pattern',
  MISTAKE: 'mistake',
  CONTEXT: 'context',
  BUSINESS_RULE: 'business_rule',
  DEPENDENCY: 'dependency',
};

export class MemoryClassifier {
  constructor(private readonly ai?: AIProvider) {}

  async classify(text: string): Promise<ClassificationResult> {
    const heuristic = heuristicClassify(text) as HeuristicLabel;
    if (!this.ai) {
      return toResult(heuristic, heuristic === 'IGNORE' ? 0.2 : 0.7, 'heuristic');
    }

    try {
      const raw = await this.ai.classify(text);
      const parsed = JSON.parse(raw) as { type?: string; confidence?: number };
      const label = (parsed.type as ClassifierLabel | undefined) ?? heuristic;
      return toResult(label, parsed.confidence ?? 0.75, 'ai');
    } catch {
      return toResult(heuristic, 0.65, 'heuristic');
    }
  }
}

function toResult(
  label: ClassifierLabel | HeuristicLabel,
  confidence: number,
  method: 'heuristic' | 'ai',
): ClassificationResult {
  const normalized = label as ClassifierLabel;
  return {
    label: normalized,
    confidence,
    method,
    memoryType: normalized === 'IGNORE' ? null : LABEL_TO_TYPE[normalized],
  };
}

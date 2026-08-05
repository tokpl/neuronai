import type { MemoryType, MemorySource } from '@neuron-ai-memory/types';
import {
  heuristicExtract,
  type AIProvider,
  type HeuristicCandidate,
} from '@neuron-ai-memory/ai-provider';

import { type MemoryClassifier } from '../classifier/memory-classifier.js';

export interface ExtractedMemoryCandidate {
  type: MemoryType;
  title: string;
  content: string;
  reason?: string;
  confidence: number;
  sourceHint?: MemorySource;
}

export interface MemoryExtractorInput {
  text: string;
  source?: MemorySource;
  context?: string;
}

export class MemoryExtractor {
  constructor(
    private readonly classifier: MemoryClassifier,
    private readonly ai?: AIProvider,
  ) {}

  async extract(input: MemoryExtractorInput): Promise<ExtractedMemoryCandidate[]> {
    let rawCandidates: HeuristicCandidate[] = heuristicExtract(input.text);

    if (this.ai) {
      try {
        const raw = await this.ai.extract(input.text);
        const parsed = JSON.parse(raw) as { candidates?: HeuristicCandidate[] };
        if (parsed.candidates?.length) {
          rawCandidates = parsed.candidates;
        }
      } catch {
        // keep heuristic candidates
      }
    }

    const results: ExtractedMemoryCandidate[] = [];
    for (const candidate of rawCandidates) {
      if (candidate.type === 'IGNORE') continue;
      const classification = await this.classifier.classify(candidate.content);
      if (!classification.memoryType) continue;

      results.push({
        type: classification.memoryType,
        title: candidate.title,
        content: candidate.content,
        reason: candidate.reason,
        confidence: Math.min(candidate.confidence, classification.confidence),
        sourceHint: input.source,
      });
    }

    // If heuristics found nothing but classifier sees value, synthesize one candidate.
    if (results.length === 0) {
      const classification = await this.classifier.classify(input.text);
      if (classification.memoryType) {
        const summary = input.text.replace(/\s+/g, ' ').trim();
        results.push({
          type: classification.memoryType,
          title: summary.slice(0, 72),
          content: summary,
          confidence: classification.confidence,
          sourceHint: input.source,
        });
      }
    }

    return results;
  }
}

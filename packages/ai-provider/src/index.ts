import { NotImplementedError } from '@neuronai/types';

export interface LlmCompletionRequest {
  system?: string;
  prompt: string;
  jsonSchemaName?: string;
}

export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<string>;
}

/** Unified AI surface used by the intelligence layer. */
export interface AIProvider {
  readonly name: string;
  analyze(text: string, context?: string): Promise<string>;
  extract(text: string): Promise<string>;
  classify(text: string): Promise<string>;
  summarize(text: string): Promise<string>;
  generateEmbedding(texts: string[]): Promise<number[][]>;
}

export interface AIProviderCapabilities {
  supportsEmbeddings: boolean;
  supportsStructuredExtract: boolean;
}

export function createLlmClient(): LlmClient {
  return {
    async complete(): Promise<string> {
      throw new NotImplementedError('ai-provider.complete');
    },
  };
}

/**
 * Deterministic mock for tests and offline development.
 * Heuristic JSON extraction - no network calls.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async analyze(text: string): Promise<string> {
    return `analysis:${text.slice(0, 120)}`;
  }

  async extract(text: string): Promise<string> {
    const candidates = heuristicExtract(text);
    return JSON.stringify({ candidates });
  }

  async classify(text: string): Promise<string> {
    const label = heuristicClassify(text);
    return JSON.stringify({ type: label, confidence: label === 'IGNORE' ? 0.2 : 0.75 });
  }

  async summarize(text: string): Promise<string> {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length <= 160 ? cleaned : `${cleaned.slice(0, 157)}...`;
  }

  async generateEmbedding(texts: string[]): Promise<number[][]> {
    return texts.map((t) => hashEmbed(t, 32));
  }
}

export type HeuristicLabel =
  | 'ARCHITECTURE_DECISION'
  | 'KNOWLEDGE'
  | 'PATTERN'
  | 'MISTAKE'
  | 'CONTEXT'
  | 'BUSINESS_RULE'
  | 'DEPENDENCY'
  | 'IGNORE';

export function heuristicClassify(text: string): HeuristicLabel {
  const t = text.toLowerCase();
  if (/(debug|tmp|temporary|wip|just checking|hello)/.test(t) && t.length < 80) {
    return 'IGNORE';
  }
  if (/(instead of|migrat|chose|decided|we use|rather than|because we)/.test(t)) {
    return 'ARCHITECTURE_DECISION';
  }
  if (/(don't|do not|avoid|never use|caused|broke|regression|footgun)/.test(t)) {
    return 'MISTAKE';
  }
  if (/(always|convention|pattern|standard|wrapper|all endpoints)/.test(t)) {
    return 'PATTERN';
  }
  if (/(depends on|dependency|module .* uses)/.test(t)) {
    return 'DEPENDENCY';
  }
  if (/(business|users need|product requirement|stakeholder)/.test(t)) {
    return 'BUSINESS_RULE';
  }
  if (/(uses|built with|stack|framework|library)/.test(t)) {
    return 'KNOWLEDGE';
  }
  if (t.length < 60) return 'CONTEXT';
  return 'KNOWLEDGE';
}

export interface HeuristicCandidate {
  type: HeuristicLabel;
  title: string;
  content: string;
  reason?: string;
  confidence: number;
}

export function heuristicExtract(text: string): HeuristicCandidate[] {
  const label = heuristicClassify(text);
  if (label === 'IGNORE') return [];

  const summary = text.replace(/\s+/g, ' ').trim();
  const title = summary.length <= 72 ? summary : `${summary.slice(0, 69).replace(/\s+\S*$/, '')}…`;

  const reasonMatch = summary.match(/because\s+(.+)$/i);
  return [
    {
      type: label,
      title,
      content: summary,
      reason: reasonMatch?.[1]?.trim(),
      confidence: label === 'ARCHITECTURE_DECISION' ? 0.91 : 0.78,
    },
  ];
}

function hashEmbed(text: string, dims: number): number[] {
  const vec = new Array<number>(dims).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    vec[i % dims]! += (code % 31) / 31;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

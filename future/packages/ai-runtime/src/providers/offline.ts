import type {
  AnalyzeResult,
  EmbedResult,
  GenerateOptions,
  GenerateResult,
  ProviderHealth,
  ReasonResult,
} from '../types.js';
import { BaseRuntimeProvider, contentHash, hashEmbed } from './base.js';

/**
 * Offline / local-heuristic provider — no network.
 * Powers Neuron Offline Mode for scan, graph, retrieval, basic analysis.
 */
export class OfflineProvider extends BaseRuntimeProvider {
  readonly id = 'offline';
  readonly kind = 'offline' as const;
  readonly name = 'Neuron Offline';
  readonly local = true;
  readonly supportsGenerate = true;
  readonly supportsEmbed = true;

  async generate(prompt: string, _options?: GenerateOptions): Promise<GenerateResult> {
    const started = Date.now();
    const cleaned = prompt.replace(/\s+/g, ' ').trim();
    const text =
      cleaned.length <= 240
        ? `[offline] ${cleaned}`
        : `[offline] ${cleaned.slice(0, 237)}...`;
    return {
      text,
      model: 'offline-heuristic',
      provider: this.id,
      latencyMs: Date.now() - started,
      offline: true,
    };
  }

  override async embed(texts: string[]): Promise<EmbedResult> {
    return {
      vectors: texts.map((t) => hashEmbed(t, 32)),
      model: 'offline-hash',
      provider: this.id,
      contentHashes: texts.map(contentHash),
      dimensions: 32,
    };
  }

  override async analyze(text: string, context?: string): Promise<AnalyzeResult> {
    const blob = `${context ?? ''} ${text}`.toLowerCase();
    const labels: string[] = [];
    if (/architect|module|service/.test(blob)) labels.push('architecture');
    if (/security|auth|secret/.test(blob)) labels.push('security');
    if (/perf|latency|slow/.test(blob)) labels.push('performance');
    return {
      summary: `Offline analysis of ${text.slice(0, 80)}…`,
      labels,
      model: 'offline-heuristic',
      provider: this.id,
    };
  }

  override async summarize(text: string): Promise<GenerateResult> {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return {
      text: cleaned.length <= 160 ? cleaned : `${cleaned.slice(0, 157)}...`,
      model: 'offline-heuristic',
      provider: this.id,
      latencyMs: 0,
      offline: true,
    };
  }

  override async reason(prompt: string, context?: string): Promise<ReasonResult> {
    return {
      conclusion: `Offline heuristic response for: ${prompt.slice(0, 120)}`,
      reasoning: `No cloud model available. Context length: ${(context ?? '').length}. Use local graph/memories.`,
      confidence: 0.4,
      model: 'offline-heuristic',
      provider: this.id,
    };
  }

  async health(): Promise<ProviderHealth> {
    return {
      id: this.id,
      ok: true,
      detail: 'Always available (no network)',
      models: ['offline-heuristic', 'offline-hash'],
    };
  }
}

export function createOfflineProvider(): OfflineProvider {
  return new OfflineProvider();
}

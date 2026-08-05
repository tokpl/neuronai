import type {
  EmbedResult,
  GenerateOptions,
  GenerateResult,
  ProviderConfigEntry,
  ProviderHealth,
} from '../types.js';
import {
  BaseRuntimeProvider,
  contentHash,
  openAiCompatibleChat,
  openAiCompatibleEmbed,
  resolveApiKey,
} from './base.js';
import { createOfflineProvider } from './offline.js';

/** OpenAI-compatible chat + embeddings (also used by many enterprise gateways). */
export class OpenAICompatibleProvider extends BaseRuntimeProvider {
  readonly kind = 'openai-compatible' as const;
  readonly local: boolean;
  readonly supportsGenerate = true;
  readonly supportsEmbed = true;
  readonly id: string;
  readonly name: string;

  constructor(private readonly cfg: ProviderConfigEntry) {
    super();
    this.id = cfg.id;
    this.name = `OpenAI-compatible (${cfg.id})`;
    this.local = /localhost|127\.0\.0\.1/.test(cfg.baseUrl ?? '');
  }

  private model(): string {
    return this.cfg.defaultModel ?? 'gpt-4o-mini';
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const baseUrl = this.cfg.baseUrl;
    if (!baseUrl) {
      return createOfflineProvider().generate(prompt, options);
    }
    try {
      const { text, latencyMs } = await openAiCompatibleChat({
        baseUrl,
        apiKey: resolveApiKey(this.cfg.apiKeyEnv),
        model: this.model(),
        prompt,
        system: options?.system,
      });
      return {
        text,
        model: this.model(),
        provider: this.id,
        latencyMs,
        offline: false,
      };
    } catch {
      return createOfflineProvider().generate(prompt, options);
    }
  }

  override async embed(texts: string[]): Promise<EmbedResult> {
    const baseUrl = this.cfg.baseUrl;
    const model = this.cfg.embeddingModel ?? 'text-embedding-3-small';
    if (!baseUrl) {
      return createOfflineProvider().embed(texts);
    }
    try {
      const { vectors } = await openAiCompatibleEmbed({
        baseUrl,
        apiKey: resolveApiKey(this.cfg.apiKeyEnv),
        model,
        texts,
      });
      return {
        vectors,
        model,
        provider: this.id,
        contentHashes: texts.map(contentHash),
        dimensions: vectors[0]?.length ?? 0,
      };
    } catch {
      return createOfflineProvider().embed(texts);
    }
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    if (!this.cfg.baseUrl) {
      return { id: this.id, ok: false, detail: 'Missing baseUrl' };
    }
    try {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/models`, {
        headers: resolveApiKey(this.cfg.apiKeyEnv)
          ? { Authorization: `Bearer ${resolveApiKey(this.cfg.apiKeyEnv)}` }
          : {},
        signal: AbortSignal.timeout(3000),
      });
      return {
        id: this.id,
        ok: res.ok,
        latencyMs: Date.now() - started,
        detail: res.ok ? 'reachable' : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        id: this.id,
        ok: false,
        latencyMs: Date.now() - started,
        detail: err instanceof Error ? err.message : 'unreachable',
      };
    }
  }
}

export function createOpenAICompatibleProvider(
  cfg: ProviderConfigEntry,
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(cfg);
}

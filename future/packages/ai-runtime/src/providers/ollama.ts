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
} from './base.js';
import { createOfflineProvider } from './offline.js';

/** Ollama local models — OpenAI-compatible + native /api/tags discovery. */
export class OllamaProvider extends BaseRuntimeProvider {
  readonly kind = 'ollama' as const;
  readonly local = true;
  readonly supportsGenerate = true;
  readonly supportsEmbed = true;
  readonly id: string;
  readonly name: string;

  constructor(private readonly cfg: ProviderConfigEntry) {
    super();
    this.id = cfg.id;
    this.name = 'Ollama';
  }

  private base(): string {
    return (this.cfg.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  }

  private model(): string {
    return this.cfg.defaultModel ?? 'llama3.2';
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    try {
      // Prefer OpenAI-compatible endpoint shipped by recent Ollama
      const { text, latencyMs } = await openAiCompatibleChat({
        baseUrl: `${this.base()}/v1`,
        model: this.model(),
        prompt,
        system: options?.system,
        timeoutMs: 30_000,
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
    const model = this.cfg.embeddingModel ?? 'nomic-embed-text';
    try {
      const { vectors } = await openAiCompatibleEmbed({
        baseUrl: `${this.base()}/v1`,
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

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.base()}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { models?: Array<{ name?: string }> };
      return (json.models ?? []).map((m) => m.name ?? '').filter(Boolean);
    } catch {
      return [];
    }
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      const models = await this.listModels();
      return {
        id: this.id,
        ok: true,
        latencyMs: Date.now() - started,
        detail: models.length ? `${models.length} model(s)` : 'reachable (no tags)',
        models,
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

export function createOllamaProvider(cfg: ProviderConfigEntry): OllamaProvider {
  return new OllamaProvider(cfg);
}

import type {
  GenerateOptions,
  GenerateResult,
  ProviderConfigEntry,
  ProviderHealth,
} from '../types.js';
import { BaseRuntimeProvider, openAiCompatibleChat, resolveApiKey } from './base.js';
import { createOfflineProvider } from './offline.js';

/**
 * Custom HTTP provider for enterprise private models.
 * Expects an OpenAI-compatible `/chat/completions` endpoint.
 */
export class CustomHttpProvider extends BaseRuntimeProvider {
  readonly kind = 'custom-http' as const;
  readonly supportsGenerate = true;
  readonly supportsEmbed = false;
  readonly id: string;
  readonly name: string;
  readonly local: boolean;

  constructor(private readonly cfg: ProviderConfigEntry) {
    super();
    this.id = cfg.id;
    this.name = `Custom HTTP (${cfg.id})`;
    this.local = /localhost|127\.0\.0\.1|\.local\b|intranet/i.test(cfg.baseUrl ?? '');
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    if (!this.cfg.baseUrl) {
      return createOfflineProvider().generate(prompt, options);
    }
    try {
      const { text, latencyMs } = await openAiCompatibleChat({
        baseUrl: this.cfg.baseUrl,
        apiKey: resolveApiKey(this.cfg.apiKeyEnv),
        model: this.cfg.defaultModel ?? 'custom-model',
        prompt,
        system: options?.system,
      });
      return {
        text,
        model: this.cfg.defaultModel ?? 'custom-model',
        provider: this.id,
        latencyMs,
        offline: false,
      };
    } catch {
      return createOfflineProvider().generate(prompt, options);
    }
  }

  async health(): Promise<ProviderHealth> {
    if (!this.cfg.baseUrl) {
      return { id: this.id, ok: false, detail: 'Missing baseUrl' };
    }
    const started = Date.now();
    try {
      const res = await fetch(this.cfg.baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return {
        id: this.id,
        ok: res.status < 500,
        latencyMs: Date.now() - started,
        detail: `HTTP ${res.status}`,
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

export function createCustomHttpProvider(cfg: ProviderConfigEntry): CustomHttpProvider {
  return new CustomHttpProvider(cfg);
}

import type {
  GenerateOptions,
  GenerateResult,
  ProviderConfigEntry,
  ProviderHealth,
} from '../types.js';
import { BaseRuntimeProvider, openAiCompatibleChat } from './base.js';
import { createOfflineProvider } from './offline.js';

/** LM Studio — local OpenAI-compatible server (default :1234). */
export class LMStudioProvider extends BaseRuntimeProvider {
  readonly kind = 'lm-studio' as const;
  readonly local = true;
  readonly supportsGenerate = true;
  readonly supportsEmbed = true;
  readonly id: string;
  readonly name: string;

  constructor(private readonly cfg: ProviderConfigEntry) {
    super();
    this.id = cfg.id;
    this.name = 'LM Studio';
  }

  private base(): string {
    return (this.cfg.baseUrl ?? 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
  }

  private model(): string {
    return this.cfg.defaultModel ?? 'local-model';
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    try {
      const { text, latencyMs } = await openAiCompatibleChat({
        baseUrl: this.base(),
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

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      const res = await fetch(`${this.base()}/models`, {
        signal: AbortSignal.timeout(3000),
      });
      const models: string[] = [];
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id?: string }> };
        for (const m of json.data ?? []) {
          if (m.id) models.push(m.id);
        }
      }
      return {
        id: this.id,
        ok: res.ok,
        latencyMs: Date.now() - started,
        detail: res.ok ? 'reachable' : `HTTP ${res.status}`,
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

export function createLMStudioProvider(cfg: ProviderConfigEntry): LMStudioProvider {
  return new LMStudioProvider(cfg);
}

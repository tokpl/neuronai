import type {
  GenerateOptions,
  GenerateResult,
  ProviderConfigEntry,
  ProviderHealth,
} from '../types.js';
import { BaseRuntimeProvider, resolveApiKey } from './base.js';
import { createOfflineProvider } from './offline.js';

/**
 * Anthropic Messages API compatible provider (architecture stub with live HTTP when configured).
 * API keys only from env — never stored in brain.
 */
export class AnthropicCompatibleProvider extends BaseRuntimeProvider {
  readonly kind = 'anthropic' as const;
  readonly local = false;
  readonly supportsGenerate = true;
  readonly supportsEmbed = false;
  readonly id: string;
  readonly name: string;

  constructor(private readonly cfg: ProviderConfigEntry) {
    super();
    this.id = cfg.id;
    this.name = `Anthropic (${cfg.id})`;
  }

  private model(): string {
    return this.cfg.defaultModel ?? 'claude-sonnet-4-20250514';
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const baseUrl = (this.cfg.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
    const apiKey = resolveApiKey(this.cfg.apiKeyEnv ?? 'ANTHROPIC_API_KEY');
    if (!apiKey) {
      return createOfflineProvider().generate(prompt, options);
    }
    const started = Date.now();
    try {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model(),
          max_tokens: options?.maxTokens ?? 1024,
          system: options?.system,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = json.content?.map((c) => c.text ?? '').join('') ?? '';
      return {
        text,
        model: this.model(),
        provider: this.id,
        latencyMs: Date.now() - started,
        offline: false,
      };
    } catch {
      return createOfflineProvider().generate(prompt, options);
    }
  }

  async health(): Promise<ProviderHealth> {
    const key = resolveApiKey(this.cfg.apiKeyEnv ?? 'ANTHROPIC_API_KEY');
    return {
      id: this.id,
      ok: Boolean(key),
      detail: key ? 'API key present (live call on generate)' : 'Missing ANTHROPIC_API_KEY',
      models: [this.model()],
    };
  }
}

export function createAnthropicCompatibleProvider(
  cfg: ProviderConfigEntry,
): AnthropicCompatibleProvider {
  return new AnthropicCompatibleProvider(cfg);
}

import type {
  AiRuntimeConfig,
  GenerateResult,
  RuntimeAIProvider,
  TaskProfileKind,
} from '../types.js';
import type { ModelRouter } from './model-router.js';
import type { PrivacyRouter } from '../privacy/privacy-router.js';

export interface HybridAIOptions {
  task: TaskProfileKind | string;
  prompt: string;
  pathHint?: string;
  /** Explicit user consent to use cloud for this call */
  allowCloudForCall?: boolean;
}

/**
 * Hybrid routing: local for parsing/simple work; cloud for heavy reasoning
 * only when config.allowCloud AND per-call consent.
 */
export class HybridAI {
  constructor(
    private readonly providers: Map<string, RuntimeAIProvider>,
    private readonly router: ModelRouter,
    private readonly privacy: PrivacyRouter,
    private readonly config: AiRuntimeConfig,
  ) {}

  async run(options: HybridAIOptions): Promise<GenerateResult & { selectionReason: string }> {
    const cfg: AiRuntimeConfig = {
      ...this.config,
      allowCloud: this.config.allowCloud && options.allowCloudForCall === true,
    };

    const selection = this.router.select({
      task: options.task,
      text: options.prompt,
      pathHint: options.pathHint,
      config: cfg,
    });

    if (selection.privacy.recommendedRoute === 'deny') {
      throw new Error(`HybridAI denied: ${selection.privacy.reason}`);
    }

    const provider =
      this.providers.get(selection.providerId) ?? this.providers.get('offline');
    if (!provider) {
      throw new Error('No AI provider available');
    }

    // Never send CRITICAL/SENSITIVE with secrets to non-local providers
    if (!provider.local && selection.privacy.containsSecrets) {
      const offline = this.providers.get('offline')!;
      const result = await offline.generate(options.prompt);
      return { ...result, selectionReason: `Forced offline: ${selection.privacy.reason}` };
    }

    const result = await provider.generate(options.prompt);
    return { ...result, selectionReason: selection.reason };
  }

  describeExample(): string {
    return [
      'Hybrid mode example:',
      '  Local:  CODE_ANALYSIS / SUMMARIZATION / MEMORY_RETRIEVAL',
      '  Cloud:  ARCHITECTURE_REASONING (only if allowCloud + consent)',
      '  Never:  secrets, .env, CRITICAL without local route',
    ].join('\n');
  }
}

export function createHybridAI(
  providers: Map<string, RuntimeAIProvider>,
  router: ModelRouter,
  privacy: PrivacyRouter,
  config: AiRuntimeConfig,
): HybridAI {
  return new HybridAI(providers, router, privacy, config);
}

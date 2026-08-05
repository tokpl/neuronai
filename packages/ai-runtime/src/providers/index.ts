import type { ProviderConfigEntry, RuntimeAIProvider } from '../types.js';
import { createAnthropicCompatibleProvider } from './anthropic.js';
import { createCustomHttpProvider } from './custom-http.js';
import { createLMStudioProvider } from './lm-studio.js';
import { createOfflineProvider } from './offline.js';
import { createOllamaProvider } from './ollama.js';
import { createOpenAICompatibleProvider } from './openai-compatible.js';

export function createProviderFromConfig(cfg: ProviderConfigEntry): RuntimeAIProvider {
  switch (cfg.kind) {
    case 'offline':
      return createOfflineProvider();
    case 'ollama':
      return createOllamaProvider(cfg);
    case 'lm-studio':
      return createLMStudioProvider(cfg);
    case 'openai-compatible':
      return createOpenAICompatibleProvider(cfg);
    case 'anthropic':
      return createAnthropicCompatibleProvider(cfg);
    case 'custom-http':
      return createCustomHttpProvider(cfg);
    default:
      return createOfflineProvider();
  }
}

export {
  createOfflineProvider,
  createOllamaProvider,
  createLMStudioProvider,
  createOpenAICompatibleProvider,
  createAnthropicCompatibleProvider,
  createCustomHttpProvider,
};

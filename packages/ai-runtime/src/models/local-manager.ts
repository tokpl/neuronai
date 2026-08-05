import { freemem, totalmem } from 'node:os';

import type { ModelDescriptor, ProviderConfigEntry, ProviderHealth } from '../types.js';
import { createLMStudioProvider } from '../providers/lm-studio.js';
import { createOllamaProvider } from '../providers/ollama.js';
import { defaultModelCatalog } from './task-profiles.js';

export interface LocalEnvironmentSnapshot {
  totalMemoryMb: number;
  freeMemoryMb: number;
  /** Heuristic — Node cannot reliably detect GPU; report unknown/estimate */
  gpu: 'unknown' | 'likely' | 'unlikely';
  ollama: ProviderHealth;
  lmStudio: ProviderHealth;
  installedModels: ModelDescriptor[];
}

/**
 * Discovers local model runtimes (Ollama, LM Studio) and host capacity.
 * Does not download or train models.
 */
export class LocalModelManager {
  async probe(providers: ProviderConfigEntry[] = []): Promise<LocalEnvironmentSnapshot> {
    const ollamaCfg =
      providers.find((p) => p.kind === 'ollama') ??
      ({
        id: 'ollama',
        kind: 'ollama' as const,
        enabled: true,
        baseUrl: 'http://127.0.0.1:11434',
      });
    const lmCfg =
      providers.find((p) => p.kind === 'lm-studio') ??
      ({
        id: 'lm-studio',
        kind: 'lm-studio' as const,
        enabled: true,
        baseUrl: 'http://127.0.0.1:1234/v1',
      });

    const ollama = createOllamaProvider(ollamaCfg);
    const lm = createLMStudioProvider(lmCfg);
    const [ollamaHealth, lmHealth] = await Promise.all([ollama.health(), lm.health()]);

    const installed: ModelDescriptor[] = [];
    for (const name of ollamaHealth.models ?? []) {
      installed.push({
        id: name,
        providerId: 'ollama',
        name,
        tier: /embed/i.test(name) ? 'embedding' : 'medium',
        contextSize: 32_000,
        local: true,
        capabilities: /embed/i.test(name)
          ? ['embed']
          : ['generate', 'analyze', 'reason'],
      });
    }
    for (const name of lmHealth.models ?? []) {
      installed.push({
        id: name,
        providerId: 'lm-studio',
        name,
        tier: 'medium',
        contextSize: 32_000,
        local: true,
        capabilities: ['generate', 'analyze', 'reason'],
      });
    }

    const freeMb = Math.round(freemem() / (1024 * 1024));
    const totalMb = Math.round(totalmem() / (1024 * 1024));

    return {
      totalMemoryMb: totalMb,
      freeMemoryMb: freeMb,
      gpu: freeMb > 8_000 ? 'unknown' : 'unlikely',
      ollama: ollamaHealth,
      lmStudio: lmHealth,
      installedModels: installed.length ? installed : defaultModelCatalog().filter((m) => m.local),
    };
  }
}

export function createLocalModelManager(): LocalModelManager {
  return new LocalModelManager();
}

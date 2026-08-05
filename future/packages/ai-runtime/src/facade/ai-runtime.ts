import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AiRuntimeConfig,
  AiRuntimeStoreDocument,
  ModelSelection,
  PrivacyCheckResult,
  ProviderHealth,
  RuntimeAIProvider,
  TaskProfileKind,
} from '../types.js';
import { DEFAULT_AI_CONFIG, nowIso } from '../types.js';
import { createContextClassifier } from '../context/classifier.js';
import { createModelPerformanceMemory } from '../evaluation/performance-memory.js';
import { createRuntimeEmbeddingProvider } from '../embeddings/runtime-embeddings.js';
import { createLocalModelManager } from '../models/local-manager.js';
import { defaultModelCatalog, getTaskProfile, listTaskProfiles } from '../models/task-profiles.js';
import { createProviderFromConfig } from '../providers/index.js';
import { createOfflineMode } from '../privacy/offline-mode.js';
import { createPrivacyRouter } from '../privacy/privacy-router.js';
import { createHybridAI } from '../routing/hybrid.js';
import { createModelRouter } from '../routing/model-router.js';

const AI_JSON = 'ai.json';
const PERF_JSON = 'ai-performance.json';

/**
 * AI Runtime facade — providers, routing, privacy, offline, performance memory.
 * Neuron is a layer over existing models — no training, no cloud platform.
 */
export class AiRuntime {
  private config: AiRuntimeConfig = { ...DEFAULT_AI_CONFIG, providers: [...DEFAULT_AI_CONFIG.providers] };
  private readonly providers = new Map<string, RuntimeAIProvider>();
  private readonly privacy = createPrivacyRouter();
  private readonly router = createModelRouter(this.privacy);
  private readonly localModels = createLocalModelManager();
  private readonly performance = createModelPerformanceMemory();
  private readonly offline = createOfflineMode();
  private readonly classifier = createContextClassifier();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(join(neuronDir, AI_JSON), 'utf8')) as Partial<AiRuntimeConfig>;
      this.config = {
        ...DEFAULT_AI_CONFIG,
        ...raw,
        providers: raw.providers?.length ? raw.providers : DEFAULT_AI_CONFIG.providers,
      };
    } catch {
      this.config = {
        ...DEFAULT_AI_CONFIG,
        providers: [...DEFAULT_AI_CONFIG.providers],
      };
    }

    try {
      const perf = JSON.parse(
        await readFile(join(neuronDir, PERF_JSON), 'utf8'),
      ) as AiRuntimeStoreDocument;
      this.performance.load(perf.performance ?? []);
    } catch {
      this.performance.load([]);
    }

    this.rebuildProviders();
  }

  async save(neuronDir: string): Promise<{ aiJson: string; perfJson: string }> {
    await mkdir(neuronDir, { recursive: true });
    const aiJson = join(neuronDir, AI_JSON);
    await writeFile(aiJson, `${JSON.stringify(this.config, null, 2)}\n`, 'utf8');

    const doc: AiRuntimeStoreDocument = {
      version: 1,
      config: this.config,
      performance: this.performance.list(),
      updatedAt: nowIso(),
    };
    const perfJson = join(neuronDir, PERF_JSON);
    await writeFile(perfJson, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return { aiJson, perfJson };
  }

  private rebuildProviders(): void {
    this.providers.clear();
    for (const entry of this.config.providers) {
      if (!entry.enabled && entry.kind !== 'offline') continue;
      this.providers.set(entry.id, createProviderFromConfig(entry));
    }
    if (!this.providers.has('offline')) {
      this.providers.set('offline', createProviderFromConfig({
        id: 'offline',
        kind: 'offline',
        enabled: true,
      }));
    }
  }

  getConfig(): AiRuntimeConfig {
    return { ...this.config, providers: [...this.config.providers] };
  }

  setConfig(patch: Partial<AiRuntimeConfig>): void {
    this.config = {
      ...this.config,
      ...patch,
      providers: patch.providers ?? this.config.providers,
    };
    this.rebuildProviders();
  }

  availableModels() {
    return defaultModelCatalog().filter((m) => {
      if (!this.config.allowCloud && !m.local) return false;
      if (this.config.mode === 'offline' && !m.local) return false;
      const p = this.providers.get(m.providerId);
      // Catalog may list cloud models before the provider is enabled — still selectable for planning.
      if (!p && !m.local && this.config.allowCloud) return true;
      if (!p) return m.local;
      return true;
    });
  }

  bestModelForTask(task: TaskProfileKind | string, text?: string, pathHint?: string): ModelSelection {
    const remembered = this.performance.bestForTask(task);
    const selection = this.router.select({
      task,
      text,
      pathHint,
      catalog: this.availableModels(),
      config: this.config,
    });
    if (remembered && remembered.quality >= 0.8) {
      const match = this.availableModels().find((m) => m.id === remembered.model);
      if (match && (match.local || this.config.allowCloud)) {
        return {
          ...selection,
          model: match,
          providerId: match.providerId,
          reason: `${selection.reason}; boosted by performance memory (quality ${(remembered.quality * 100).toFixed(0)}%)`,
        };
      }
    }
    return selection;
  }

  privacyCheck(text: string, pathHint?: string): PrivacyCheckResult {
    return this.privacy.check({ text, pathHint, config: this.config });
  }

  async modelHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];
    for (const p of this.providers.values()) {
      results.push(await p.health());
    }
    return results;
  }

  async status() {
    const local = await this.localModels.probe(this.config.providers);
    const health = await this.modelHealth();
    return {
      mode: this.config.mode,
      allowCloud: this.config.allowCloud,
      preferredProvider: this.config.preferredProvider,
      offline: this.offline.capabilities(this.config),
      offlineDescription: this.offline.describe(),
      local,
      health,
      profiles: listTaskProfiles(),
      performance: this.performance.list().slice(0, 20),
    };
  }

  selectModel(task: TaskProfileKind | string, text?: string, pathHint?: string) {
    return this.bestModelForTask(task, text, pathHint);
  }

  hybrid() {
    return createHybridAI(this.providers, this.router, this.privacy, this.config);
  }

  embeddingProvider(providerId?: string) {
    const p =
      this.providers.get(providerId ?? this.config.preferredProvider ?? 'offline') ??
      this.providers.get('offline')!;
    return createRuntimeEmbeddingProvider(p);
  }

  recordPerformance(input: {
    model: string;
    provider: string;
    task: TaskProfileKind | string;
    quality: number;
    latencyMs: number;
    costEstimate?: number;
  }) {
    return this.performance.record(input);
  }

  classify(pathHint?: string, text?: string) {
    return this.classifier.classify(pathHint, text);
  }

  taskProfile(kind: TaskProfileKind | string) {
    return getTaskProfile(kind);
  }
}

export function createAiRuntime(): AiRuntime {
  return new AiRuntime();
}

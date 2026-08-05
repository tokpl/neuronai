export type {
  AiRuntimeMode,
  ProviderKind,
  TaskProfileKind,
  DataClassification,
  ModelTier,
  GenerateOptions,
  GenerateResult,
  EmbedResult,
  AnalyzeResult,
  ReasonResult,
  RuntimeAIProvider,
  ProviderHealth,
  ModelDescriptor,
  TaskProfile,
  AiRuntimeConfig,
  ProviderConfigEntry,
  ModelPerformanceRecord,
  PrivacyCheckResult,
  ModelSelection,
  AiRuntimeStoreDocument,
} from './types.js';
export { DEFAULT_AI_CONFIG, nowIso, newId } from './types.js';

export {
  createProviderFromConfig,
  createOfflineProvider,
  createOllamaProvider,
  createLMStudioProvider,
  createOpenAICompatibleProvider,
  createAnthropicCompatibleProvider,
  createCustomHttpProvider,
} from './providers/index.js';
export { BaseRuntimeProvider, contentHash, hashEmbed } from './providers/base.js';

export {
  TASK_PROFILES,
  getTaskProfile,
  listTaskProfiles,
  defaultModelCatalog,
} from './models/task-profiles.js';
export { LocalModelManager, createLocalModelManager } from './models/local-manager.js';

export { ModelRouter, createModelRouter } from './routing/model-router.js';
export { HybridAI, createHybridAI } from './routing/hybrid.js';

export { PrivacyRouter, createPrivacyRouter } from './privacy/privacy-router.js';
export { OfflineMode, createOfflineMode } from './privacy/offline-mode.js';
export { ContextClassifier, createContextClassifier } from './context/classifier.js';

export {
  RuntimeEmbeddingProvider,
  createRuntimeEmbeddingProvider,
} from './embeddings/runtime-embeddings.js';
export {
  ModelPerformanceMemory,
  createModelPerformanceMemory,
} from './evaluation/performance-memory.js';

export { AiRuntime, createAiRuntime } from './facade/ai-runtime.js';

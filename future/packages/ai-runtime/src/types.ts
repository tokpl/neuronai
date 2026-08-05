export type AiRuntimeMode = 'local' | 'cloud' | 'hybrid' | 'offline';

export type ProviderKind =
  | 'openai-compatible'
  | 'anthropic'
  | 'ollama'
  | 'lm-studio'
  | 'custom-http'
  | 'offline';

export type TaskProfileKind =
  | 'CODE_ANALYSIS'
  | 'MEMORY_RETRIEVAL'
  | 'SUMMARIZATION'
  | 'SECURITY_REVIEW'
  | 'ARCHITECTURE_REASONING'
  | 'DOCUMENTATION';

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'CRITICAL';

export type ModelTier = 'small' | 'medium' | 'large' | 'embedding';

export interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: string;
  latencyMs: number;
  offline: boolean;
}

export interface EmbedResult {
  vectors: number[][];
  model: string;
  provider: string;
  /** Content hashes only — never store source text alongside vectors by default */
  contentHashes: string[];
  dimensions: number;
}

export interface AnalyzeResult {
  summary: string;
  labels: string[];
  model: string;
  provider: string;
}

export interface ReasonResult {
  conclusion: string;
  reasoning: string;
  confidence: number;
  model: string;
  provider: string;
}

/**
 * Unified runtime AI contract.
 * Every provider implements the same surface — Neuron never binds to one vendor.
 */
export interface RuntimeAIProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly name: string;
  readonly local: boolean;
  readonly supportsGenerate: boolean;
  readonly supportsEmbed: boolean;

  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  embed(texts: string[]): Promise<EmbedResult>;
  analyze(text: string, context?: string): Promise<AnalyzeResult>;
  summarize(text: string): Promise<GenerateResult>;
  reason(prompt: string, context?: string): Promise<ReasonResult>;

  health(): Promise<ProviderHealth>;
}

export interface ProviderHealth {
  id: string;
  ok: boolean;
  latencyMs?: number;
  detail: string;
  models?: string[];
}

export interface ModelDescriptor {
  id: string;
  providerId: string;
  name: string;
  tier: ModelTier;
  contextSize: number;
  local: boolean;
  capabilities: Array<'generate' | 'embed' | 'analyze' | 'reason'>;
}

export interface TaskProfile {
  kind: TaskProfileKind;
  recommendedTier: ModelTier;
  preferredLocal: boolean;
  contextSize: number;
  quality: 'fast' | 'balanced' | 'high';
  description: string;
}

export interface AiRuntimeConfig {
  mode: AiRuntimeMode;
  allowCloud: boolean;
  preferredProvider?: string;
  providers: ProviderConfigEntry[];
  /** Never log raw prompts containing secrets */
  redactLogs: boolean;
}

export interface ProviderConfigEntry {
  id: string;
  kind: ProviderKind;
  enabled: boolean;
  baseUrl?: string;
  /** Env var name for API key — never store the key in brain */
  apiKeyEnv?: string;
  defaultModel?: string;
  embeddingModel?: string;
}

export interface ModelPerformanceRecord {
  id: string;
  model: string;
  provider: string;
  task: TaskProfileKind | string;
  quality: number;
  latencyMs: number;
  costEstimate: number;
  samples: number;
  updatedAt: string;
}

export interface PrivacyCheckResult {
  allowed: boolean;
  classification: DataClassification;
  containsSecrets: boolean;
  localOnlyRequired: boolean;
  cloudBlocked: boolean;
  reason: string;
  recommendedRoute: 'local' | 'cloud' | 'deny' | 'offline';
}

export interface ModelSelection {
  model: ModelDescriptor;
  providerId: string;
  reason: string;
  profile: TaskProfile;
  privacy: PrivacyCheckResult;
}

export interface AiRuntimeStoreDocument {
  version: 1;
  config: AiRuntimeConfig;
  performance: ModelPerformanceRecord[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_AI_CONFIG: AiRuntimeConfig = {
  mode: 'hybrid',
  allowCloud: false,
  preferredProvider: 'ollama',
  redactLogs: true,
  providers: [
    {
      id: 'offline',
      kind: 'offline',
      enabled: true,
      defaultModel: 'offline-heuristic',
    },
    {
      id: 'ollama',
      kind: 'ollama',
      enabled: true,
      baseUrl: 'http://127.0.0.1:11434',
      defaultModel: 'llama3.2',
      embeddingModel: 'nomic-embed-text',
    },
    {
      id: 'lm-studio',
      kind: 'lm-studio',
      enabled: true,
      baseUrl: 'http://127.0.0.1:1234/v1',
      defaultModel: 'local-model',
    },
    {
      id: 'openai',
      kind: 'openai-compatible',
      enabled: false,
      baseUrl: 'https://api.openai.com/v1',
      apiKeyEnv: 'OPENAI_API_KEY',
      defaultModel: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small',
    },
    {
      id: 'anthropic',
      kind: 'anthropic',
      enabled: false,
      baseUrl: 'https://api.anthropic.com',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      defaultModel: 'claude-sonnet-4-20250514',
    },
  ],
};

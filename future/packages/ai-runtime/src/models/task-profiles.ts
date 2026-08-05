import type { ModelDescriptor, TaskProfile, TaskProfileKind } from '../types.js';

export const TASK_PROFILES: Record<TaskProfileKind, TaskProfile> = {
  CODE_ANALYSIS: {
    kind: 'CODE_ANALYSIS',
    recommendedTier: 'medium',
    preferredLocal: true,
    contextSize: 16_000,
    quality: 'balanced',
    description: 'Parse and analyze source structure locally when possible',
  },
  MEMORY_RETRIEVAL: {
    kind: 'MEMORY_RETRIEVAL',
    recommendedTier: 'embedding',
    preferredLocal: true,
    contextSize: 4_000,
    quality: 'fast',
    description: 'Embedding + retrieval — prefer local embedders',
  },
  SUMMARIZATION: {
    kind: 'SUMMARIZATION',
    recommendedTier: 'small',
    preferredLocal: true,
    contextSize: 8_000,
    quality: 'fast',
    description: 'Short summaries — small local model',
  },
  SECURITY_REVIEW: {
    kind: 'SECURITY_REVIEW',
    recommendedTier: 'medium',
    preferredLocal: true,
    contextSize: 16_000,
    quality: 'high',
    description: 'Security review — local-first; never send secrets to cloud',
  },
  ARCHITECTURE_REASONING: {
    kind: 'ARCHITECTURE_REASONING',
    recommendedTier: 'large',
    preferredLocal: false,
    contextSize: 64_000,
    quality: 'high',
    description: 'Deep architecture reasoning — large model (cloud only with consent)',
  },
  DOCUMENTATION: {
    kind: 'DOCUMENTATION',
    recommendedTier: 'medium',
    preferredLocal: true,
    contextSize: 16_000,
    quality: 'balanced',
    description: 'Docs generation from local brain context',
  },
};

export function getTaskProfile(kind: TaskProfileKind | string): TaskProfile {
  const key = kind as TaskProfileKind;
  return TASK_PROFILES[key] ?? TASK_PROFILES.CODE_ANALYSIS;
}

export function listTaskProfiles(): TaskProfile[] {
  return Object.values(TASK_PROFILES);
}

/** Catalog stubs used when live discovery is unavailable. */
export function defaultModelCatalog(): ModelDescriptor[] {
  return [
    {
      id: 'offline-heuristic',
      providerId: 'offline',
      name: 'Offline heuristic',
      tier: 'small',
      contextSize: 8_000,
      local: true,
      capabilities: ['generate', 'embed', 'analyze', 'reason'],
    },
    {
      id: 'llama3.2',
      providerId: 'ollama',
      name: 'Llama 3.2 (Ollama)',
      tier: 'small',
      contextSize: 128_000,
      local: true,
      capabilities: ['generate', 'analyze', 'reason'],
    },
    {
      id: 'nomic-embed-text',
      providerId: 'ollama',
      name: 'Nomic Embed (Ollama)',
      tier: 'embedding',
      contextSize: 8_000,
      local: true,
      capabilities: ['embed'],
    },
    {
      id: 'local-model',
      providerId: 'lm-studio',
      name: 'LM Studio local',
      tier: 'medium',
      contextSize: 32_000,
      local: true,
      capabilities: ['generate', 'analyze', 'reason'],
    },
    {
      id: 'gpt-4o-mini',
      providerId: 'openai',
      name: 'GPT-4o mini',
      tier: 'medium',
      contextSize: 128_000,
      local: false,
      capabilities: ['generate', 'analyze', 'reason'],
    },
    {
      id: 'text-embedding-3-small',
      providerId: 'openai',
      name: 'OpenAI embeddings',
      tier: 'embedding',
      contextSize: 8_000,
      local: false,
      capabilities: ['embed'],
    },
    {
      id: 'claude-sonnet-4-20250514',
      providerId: 'anthropic',
      name: 'Claude Sonnet',
      tier: 'large',
      contextSize: 200_000,
      local: false,
      capabilities: ['generate', 'analyze', 'reason'],
    },
  ];
}

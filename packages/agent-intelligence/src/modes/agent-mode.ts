import type { PreparationMode } from '@neuronai/brain';
import { resolvePreparationMode } from '@neuronai/brain';

/**
 * Retrieval profile keys (legacy MCP enums still accepted).
 * Prompt depth is owned by PreparationMode (minimal | standard | deep).
 */
export type AgentMode = 'fast' | 'standard' | 'architect' | 'debug';

export interface AgentModeProfile {
  mode: AgentMode;
  memoryLimit: number;
  graphDepth: number;
  includeRisks: boolean;
  includePlan: boolean;
  includeFullGraphHints: boolean;
  description: string;
}

const PROFILES: Record<AgentMode, AgentModeProfile> = {
  fast: {
    mode: 'fast',
    memoryLimit: 8,
    graphDepth: 1,
    includeRisks: false,
    includePlan: false,
    includeFullGraphHints: false,
    description: 'Minimal high-signal context only',
  },
  standard: {
    mode: 'standard',
    memoryLimit: 12,
    graphDepth: 2,
    includeRisks: false,
    includePlan: false,
    includeFullGraphHints: false,
    description: 'Normal development context + hints',
  },
  architect: {
    mode: 'architect',
    memoryLimit: 20,
    graphDepth: 3,
    includeRisks: true,
    includePlan: true,
    includeFullGraphHints: true,
    description: 'Deep architecture analysis (plans + risks)',
  },
  debug: {
    mode: 'debug',
    memoryLimit: 20,
    graphDepth: 3,
    includeRisks: true,
    includePlan: true,
    includeFullGraphHints: true,
    description: 'Deep retrieval + developer debug dump',
  },
};

/** Map Brain preparation mode → retrieval profile. */
export function agentModeForPreparation(mode: PreparationMode): AgentMode {
  if (mode === 'minimal') return 'fast';
  if (mode === 'deep') return 'architect';
  return 'standard';
}

/**
 * Resolve MCP / CLI mode string.
 * Default is **fast** (maps to preparation minimal) for everyday coding.
 */
export function resolveAgentMode(value?: string): AgentMode {
  const prep = resolvePreparationMode(value);
  if (value === 'debug' || prep.debug) return 'debug';
  return agentModeForPreparation(prep.mode);
}

export function getAgentModeProfile(mode?: AgentMode | string): AgentModeProfile {
  return PROFILES[resolveAgentMode(mode)];
}

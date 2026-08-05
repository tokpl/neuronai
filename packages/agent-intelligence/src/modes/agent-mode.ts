/**
 * How much context / analysis depth to apply for the agent.
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
    memoryLimit: 5,
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
    includeRisks: true,
    includePlan: true,
    includeFullGraphHints: false,
    description: 'Normal development context',
  },
  architect: {
    mode: 'architect',
    memoryLimit: 20,
    graphDepth: 3,
    includeRisks: true,
    includePlan: true,
    includeFullGraphHints: true,
    description: 'Full architecture analysis',
  },
  debug: {
    mode: 'debug',
    memoryLimit: 15,
    graphDepth: 3,
    includeRisks: true,
    includePlan: false,
    includeFullGraphHints: true,
    description: 'Problems, history, and change blast radius',
  },
};

export function resolveAgentMode(value?: string): AgentMode {
  if (value === 'fast' || value === 'standard' || value === 'architect' || value === 'debug') {
    return value;
  }
  return 'standard';
}

export function getAgentModeProfile(mode?: AgentMode | string): AgentModeProfile {
  return PROFILES[resolveAgentMode(mode)];
}

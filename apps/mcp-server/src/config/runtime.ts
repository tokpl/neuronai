import {
  createAgentWorkflow,
  parsePrivacyMode,
  type AgentWorkflowOrchestrator,
  type PrivacyMode,
} from '@neuronai/agent-workflow';
import { createNeuronRuntime, type NeuronRuntime } from '@neuronai/storage';
import type { MemoryType } from '@neuronai/types';

import { createLogger, type Logger } from '../logger.js';

/** Last ask-before-remember draft, awaiting Yes / No / rephrase. */
export interface PendingMemorySuggestion {
  type: MemoryType;
  title: string;
  draftContent: string;
  reason: string;
  confidence: number;
  task?: string;
}

/**
 * MCP adapter state. The shared runtime does all the wiring; this only adds
 * what is specific to serving an agent over stdio.
 */
export interface McpRuntime {
  neuron: NeuronRuntime;
  workflow: AgentWorkflowOrchestrator;
  privacyMode: PrivacyMode;
  logger: Logger;
  pendingSuggestion: PendingMemorySuggestion | null;
}

export async function createMcpRuntime(cwd = process.cwd()): Promise<McpRuntime> {
  // stdout is reserved for MCP JSON-RPC — never log there.
  const logger = createLogger('stderr');
  const neuron = await createNeuronRuntime({ cwd });

  const privacyMode = parsePrivacyMode(
    neuron.brain.prefs?.privacy?.mode ?? process.env['NEURON_PRIVACY_MODE'],
  );

  const workflow = createAgentWorkflow({
    projectId: neuron.project.projectId,
    privacy: privacyMode,
    engine: neuron.engine,
    listExistingMemories: async () => neuron.listMemories(),
  });

  logger.info('Neuron runtime ready', {
    project: neuron.project.name,
    memories: neuron.listMemories().length,
    privacyMode,
  });

  return { neuron, workflow, privacyMode, logger, pendingSuggestion: null };
}

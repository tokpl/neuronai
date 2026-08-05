import { filterTraceText } from './filters.js';
import type { AIModelTrace } from './types.js';
import { newId } from './types.js';

export interface RecordAIModelTraceInput {
  neuronTraceId: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  costEstimate?: number;
  success: boolean;
}

export function createAIModelTrace(input: RecordAIModelTraceInput): AIModelTrace {
  return {
    id: newId('amt'),
    neuronTraceId: input.neuronTraceId,
    provider: filterTraceText(input.provider, 60),
    model: filterTraceText(input.model, 80),
    tokensInput: Math.max(0, Math.round(input.tokensInput)),
    tokensOutput: Math.max(0, Math.round(input.tokensOutput)),
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    costEstimate: Math.max(0, input.costEstimate ?? 0),
    success: input.success,
  };
}

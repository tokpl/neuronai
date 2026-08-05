import { filterPathList, filterTraceText } from './filters.js';
import type { NeuronTrace, OperationKind } from './types.js';
import { newId, nowIso } from './types.js';

export interface RecordNeuronTraceInput {
  operation: string;
  operationKind?: OperationKind;
  durationMs: number;
  inputType: string;
  contextSources?: string[];
  modelUsed?: string;
  outputType: string;
  confidence?: number;
  summary?: string;
  timestamp?: string;
}

export function createNeuronTrace(input: RecordNeuronTraceInput): NeuronTrace {
  return {
    id: newId('ntr'),
    operation: filterTraceText(input.operation, 120),
    operationKind: input.operationKind ?? 'other',
    timestamp: input.timestamp ?? nowIso(),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    inputType: filterTraceText(input.inputType, 80),
    contextSources: filterPathList(input.contextSources ?? []),
    modelUsed: input.modelUsed ? filterTraceText(input.modelUsed, 80) : undefined,
    outputType: filterTraceText(input.outputType, 80),
    confidence:
      input.confidence === undefined
        ? undefined
        : Math.max(0, Math.min(1, input.confidence)),
    summary: filterTraceText(input.summary ?? input.operation, 400),
  };
}

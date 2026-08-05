import { filterTraceText } from './filters.js';
import type { ReasoningStep, ReasoningTrace } from './types.js';
import { newId } from './types.js';

export interface BuildReasoningTraceInput {
  neuronTraceId: string;
  userRequest: string;
  contextRetrieval?: string;
  selectedMemories?: string[];
  graphTraversal?: string;
  rulesApplied?: string[];
  modelGeneration?: string;
  finalResponse?: string;
  finalConfidence?: number;
}

/**
 * Builds a linear reasoning path:
 * User request → Context → Memories → Graph → Rules → Model → Response
 */
export function createReasoningTrace(input: BuildReasoningTraceInput): ReasoningTrace {
  const steps: ReasoningStep[] = [
    {
      stage: 'user_request',
      detail: filterTraceText(input.userRequest, 300),
    },
    {
      stage: 'context_retrieval',
      detail: filterTraceText(input.contextRetrieval ?? 'Context retrieval', 300),
    },
    {
      stage: 'selected_memories',
      detail:
        input.selectedMemories?.length
          ? `Selected ${input.selectedMemories.length} memories`
          : 'No memories selected',
      refs: (input.selectedMemories ?? []).map((m) => filterTraceText(m, 120)).slice(0, 20),
    },
    {
      stage: 'graph_traversal',
      detail: filterTraceText(input.graphTraversal ?? 'Graph traversal', 300),
    },
    {
      stage: 'rules_applied',
      detail:
        input.rulesApplied?.length
          ? `Applied ${input.rulesApplied.length} rules`
          : 'No rules applied',
      refs: (input.rulesApplied ?? []).map((r) => filterTraceText(r, 120)).slice(0, 20),
    },
    {
      stage: 'model_generation',
      detail: filterTraceText(input.modelGeneration ?? 'Model generation', 300),
    },
    {
      stage: 'final_response',
      detail: filterTraceText(input.finalResponse ?? 'Final response', 400),
    },
  ];

  return {
    id: newId('rtr'),
    neuronTraceId: input.neuronTraceId,
    steps,
    finalConfidence:
      input.finalConfidence === undefined
        ? undefined
        : Math.max(0, Math.min(1, input.finalConfidence)),
  };
}

export function formatReasoningPath(trace: ReasoningTrace): string {
  return trace.steps
    .map((s, i) => {
      const arrow = i === 0 ? '' : '↓\n';
      const refs =
        s.refs && s.refs.length ? `\n  refs: ${s.refs.slice(0, 5).join(', ')}` : '';
      return `${arrow}${s.stage}: ${s.detail}${refs}`;
    })
    .join('\n');
}

import { filterTraceText } from './filters.js';
import type { MemoryUsageTrace } from './types.js';
import { newId } from './types.js';

export interface MemoryUsageItem {
  title: string;
  confidence: number;
  reason: string;
}

export function createMemoryUsageTrace(
  neuronTraceId: string,
  memories: MemoryUsageItem[],
): MemoryUsageTrace {
  return {
    id: newId('mut'),
    neuronTraceId,
    memories: memories.slice(0, 30).map((m) => ({
      title: filterTraceText(m.title, 160),
      confidence: Math.max(0, Math.min(1, m.confidence)),
      reason: filterTraceText(m.reason, 240),
    })),
  };
}

export function formatMemoryUsage(trace: MemoryUsageTrace): string {
  if (!trace.memories.length) return 'Used: (none)';
  return trace.memories
    .map(
      (m) =>
        `Used:\n${m.title}\n\nConfidence:\n${Math.round(m.confidence * 100)}%\n\nReason:\n${m.reason}`,
    )
    .join('\n\n---\n\n');
}

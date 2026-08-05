import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AIModelTrace,
  MemoryUsageTrace,
  NeuronMetricsSnapshot,
  NeuronTrace,
  ReasoningTrace,
} from '../tracing/types.js';
import { formatReasoningPath } from '../tracing/reasoning-trace.js';
import { nowIso } from '../tracing/types.js';

export interface ObservabilityReportInput {
  operation: NeuronTrace;
  reasoning?: ReasoningTrace;
  memoryUsage?: MemoryUsageTrace;
  model?: AIModelTrace;
  metrics?: NeuronMetricsSnapshot;
  confidence?: number;
}

export function renderObservabilityReport(input: ObservabilityReportInput): string {
  const conf =
    input.confidence ??
    input.operation.confidence ??
    input.reasoning?.finalConfidence;

  const lines = [
    '# Neuron Observability Report',
    '',
    `_Generated ${nowIso()}_`,
    '',
    '## Operation',
    '',
    `- **id:** ${input.operation.id}`,
    `- **operation:** ${input.operation.operation}`,
    `- **kind:** ${input.operation.operationKind}`,
    `- **duration:** ${input.operation.durationMs} ms`,
    `- **input:** ${input.operation.inputType}`,
    `- **output:** ${input.operation.outputType}`,
    `- **model:** ${input.operation.modelUsed ?? 'n/a'}`,
    `- **summary:** ${input.operation.summary}`,
    '',
    '## Context used',
    '',
  ];

  if (input.operation.contextSources.length) {
    for (const s of input.operation.contextSources) {
      lines.push(`- ${s}`);
    }
  } else {
    lines.push('- (none recorded)');
  }

  if (input.memoryUsage?.memories.length) {
    lines.push('', '### Memories', '');
    for (const m of input.memoryUsage.memories) {
      lines.push(
        `- **${m.title}** — ${Math.round(m.confidence * 100)}% — ${m.reason}`,
      );
    }
  }

  lines.push('', '## Reasoning path', '');
  if (input.reasoning) {
    lines.push('```', formatReasoningPath(input.reasoning), '```');
  } else {
    lines.push('_No reasoning trace recorded._');
  }

  lines.push('', '## Performance', '');
  if (input.metrics) {
    lines.push(
      `- scan: ${input.metrics.scanTimeMs} ms`,
      `- retrieval: ${input.metrics.retrievalLatencyMs} ms`,
      `- graph: ${input.metrics.graphQueryMs} ms`,
      `- model: ${input.metrics.modelLatencyMs} ms`,
      `- memory size: ${input.metrics.memorySize}`,
    );
  } else {
    lines.push(`- operation duration: ${input.operation.durationMs} ms`);
  }

  if (input.model) {
    lines.push(
      '',
      '### Model',
      '',
      `- provider: ${input.model.provider}`,
      `- model: ${input.model.model}`,
      `- tokens in/out: ${input.model.tokensInput} / ${input.model.tokensOutput}`,
      `- latency: ${input.model.latencyMs} ms`,
      `- cost estimate: ${input.model.costEstimate}`,
      `- success: ${input.model.success}`,
    );
  }

  lines.push(
    '',
    '## Confidence',
    '',
    conf === undefined ? '_n/a_' : `${Math.round(conf * 100)}%`,
    '',
    '---',
    '',
    '_Internal debugger only — no cloud analytics, no user tracking._',
    '',
  );

  return lines.join('\n');
}

export async function writeObservabilityReport(
  neuronDir: string,
  input: ObservabilityReportInput,
  filename = 'neuron-report.md',
): Promise<string> {
  await mkdir(neuronDir, { recursive: true });
  const path = join(neuronDir, filename);
  await writeFile(path, renderObservabilityReport(input), 'utf8');
  return path;
}

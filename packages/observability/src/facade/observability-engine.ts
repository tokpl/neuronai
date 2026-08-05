import { createDecisionDebugger } from '../debug/decision-debugger.js';
import { createNeuronErrorAnalyzer } from '../debug/error-analyzer.js';
import { createRetrievalDebugger } from '../debug/retrieval-debugger.js';
import { createObservabilityEventBus } from '../events/event-bus.js';
import { createNeuronMetrics } from '../metrics/neuron-metrics.js';
import {
  renderObservabilityReport,
  writeObservabilityReport,
} from '../reports/observability-report.js';
import { createAIModelTrace } from '../tracing/ai-model-trace.js';
import { createMemoryUsageTrace } from '../tracing/memory-usage-trace.js';
import { createNeuronTrace } from '../tracing/neuron-trace.js';
import {
  createReasoningTrace,
  formatReasoningPath,
} from '../tracing/reasoning-trace.js';
import { createTraceStore, type TraceStore } from '../tracing/trace-store.js';
import type {
  AIModelTrace,
  AnalyzedError,
  DecisionDebugSnapshot,
  MemoryUsageTrace,
  NeuronMetricsSnapshot,
  NeuronTrace,
  ReasoningTrace,
  RetrievalDebugSnapshot,
  TraceRetentionPolicy,
} from '../tracing/types.js';
import { nowIso } from '../tracing/types.js';
import type { RecordNeuronTraceInput } from '../tracing/neuron-trace.js';
import type { BuildReasoningTraceInput } from '../tracing/reasoning-trace.js';
import type { MemoryUsageItem } from '../tracing/memory-usage-trace.js';
import type { RecordAIModelTraceInput } from '../tracing/ai-model-trace.js';
import type { RetrievalDebuggerInput } from '../debug/retrieval-debugger.js';
import type { DecisionDebuggerInput } from '../debug/decision-debugger.js';
import type { AnalyzeErrorInput } from '../debug/error-analyzer.js';

export interface RecordOperationInput {
  trace: RecordNeuronTraceInput;
  reasoning?: Omit<BuildReasoningTraceInput, 'neuronTraceId'>;
  memories?: MemoryUsageItem[];
  model?: Omit<RecordAIModelTraceInput, 'neuronTraceId'>;
  retrieval?: RetrievalDebuggerInput;
  decision?: DecisionDebuggerInput;
}

export interface ExplainLastResult {
  trace?: NeuronTrace;
  reasoning?: ReasoningTrace;
  reasoningPath?: string;
  memoryUsage?: MemoryUsageTrace;
  model?: AIModelTrace;
  retrieval?: RetrievalDebugSnapshot;
  decision?: DecisionDebugSnapshot;
  debugMode: boolean;
  reportMarkdown: string;
}

/**
 * Internal Neuron observability facade (local JSON traces - no cloud).
 */
export class ObservabilityEngine {
  readonly store: TraceStore;
  readonly metrics = createNeuronMetrics();
  readonly retrievalDebugger = createRetrievalDebugger();
  readonly decisionDebugger = createDecisionDebugger();
  readonly errorAnalyzer = createNeuronErrorAnalyzer();
  readonly events = createObservabilityEventBus();

  private lastRetrieval?: RetrievalDebugSnapshot;
  private lastDecision?: DecisionDebugSnapshot;

  constructor(store = createTraceStore()) {
    this.store = store;
  }

  async load(neuronDir: string): Promise<void> {
    await this.store.load(neuronDir);
  }

  async save(neuronDir: string): Promise<string> {
    const snap = this.metrics.snapshot();
    this.store.getDocument().metrics.unshift(snap);
    return this.store.save(neuronDir);
  }

  isDebugMode(): boolean {
    return this.store.isDebugMode();
  }

  setDebugMode(on: boolean): boolean {
    this.store.setDebugMode(on);
    this.events.emit({
      type: on ? 'debug.enabled' : 'debug.disabled',
      at: nowIso(),
    });
    return on;
  }

  setRetention(policy: Partial<TraceRetentionPolicy>): TraceRetentionPolicy {
    const next = this.store.setRetention(policy);
    this.events.emit({
      type: 'retention.changed',
      at: nowIso(),
      payload: { ...next },
    });
    return next;
  }

  getRetention(): TraceRetentionPolicy {
    return this.store.getRetention();
  }

  recordOperation(input: RecordOperationInput): NeuronTrace {
    const trace = createNeuronTrace(input.trace);
    this.store.recordTrace(trace);

    if (input.reasoning) {
      this.store.recordReasoning(
        createReasoningTrace({ ...input.reasoning, neuronTraceId: trace.id }),
      );
    }
    if (input.memories?.length) {
      this.store.recordMemoryUsage(createMemoryUsageTrace(trace.id, input.memories));
    }
    if (input.model) {
      this.store.recordModel(createAIModelTrace({ ...input.model, neuronTraceId: trace.id }));
      this.metrics.recordModelLatency(input.model.latencyMs);
    }
    if (input.retrieval) {
      this.lastRetrieval = this.retrievalDebugger.snapshot(input.retrieval);
      this.metrics.recordRetrieval(0);
    }
    if (input.decision) {
      this.lastDecision = this.decisionDebugger.snapshot(input.decision);
    }

    this.events.emit({
      type: 'trace.recorded',
      at: nowIso(),
      payload: { id: trace.id, operation: trace.operation },
    });

    return trace;
  }

  debugRetrieval(input: RetrievalDebuggerInput): RetrievalDebugSnapshot {
    this.lastRetrieval = this.retrievalDebugger.snapshot(input);
    return this.lastRetrieval;
  }

  debugDecision(input: DecisionDebuggerInput): DecisionDebugSnapshot {
    this.lastDecision = this.decisionDebugger.snapshot(input);
    return this.lastDecision;
  }

  analyzeError(input: AnalyzeErrorInput): AnalyzedError {
    const result = this.errorAnalyzer.analyze(input);
    this.events.emit({
      type: 'error.analyzed',
      at: nowIso(),
      payload: { category: result.category, module: result.affectedModule },
    });
    return result;
  }

  performanceMetrics(): NeuronMetricsSnapshot {
    const snap = this.metrics.snapshot();
    this.events.emit({ type: 'metrics.snapshot', at: nowIso() });
    return snap;
  }

  lastTrace(): NeuronTrace | undefined {
    return this.store.lastTrace();
  }

  explainLast(): ExplainLastResult {
    const trace = this.store.lastTrace();
    const reasoning = trace
      ? this.store.lastReasoning(trace.id)
      : this.store.lastReasoning();
    const memoryUsage = trace
      ? this.store.lastMemoryUsage(trace.id)
      : this.store.lastMemoryUsage();
    const model = trace ? this.store.lastModel(trace.id) : this.store.lastModel();
    const metrics = this.store.getDocument().metrics[0] ?? this.metrics.snapshot();

    const reportMarkdown = trace
      ? renderObservabilityReport({
          operation: trace,
          reasoning,
          memoryUsage,
          model,
          metrics,
        })
      : '# Neuron Observability Report\n\n_No traces recorded yet._\n';

    return {
      trace,
      reasoning,
      reasoningPath: reasoning ? formatReasoningPath(reasoning) : undefined,
      memoryUsage,
      model,
      retrieval: this.lastRetrieval,
      decision: this.lastDecision,
      debugMode: this.isDebugMode(),
      reportMarkdown,
    };
  }

  async writeReport(neuronDir: string): Promise<string | undefined> {
    const explained = this.explainLast();
    if (!explained.trace) return undefined;
    return writeObservabilityReport(neuronDir, {
      operation: explained.trace,
      reasoning: explained.reasoning,
      memoryUsage: explained.memoryUsage,
      model: explained.model,
      metrics: this.store.getDocument().metrics[0] ?? this.metrics.snapshot(),
    });
  }

  /** Verbose dump when debug mode is ON */
  debugSessionSummary(): string {
    const e = this.explainLast();
    const lines = [
      `Debug mode: ${e.debugMode ? 'ON' : 'OFF'}`,
      `Retention: ${JSON.stringify(this.getRetention())}`,
      '',
      '=== Verbose reasoning trace ===',
      e.reasoningPath ?? '(none)',
      '',
      '=== Retrieval details ===',
      e.retrieval ? this.retrievalDebugger.format(e.retrieval) : '(none in-session)',
      '',
      '=== Decision ===',
      e.decision ? this.decisionDebugger.format(e.decision) : '(none in-session)',
      '',
      '=== Module / operation ===',
      e.trace
        ? `${e.trace.operation} (${e.trace.durationMs} ms) confidence=${e.trace.confidence ?? 'n/a'}`
        : '(no last operation)',
      '',
      '=== Memory usage ===',
      e.memoryUsage
        ? e.memoryUsage.memories
            .map(
              (m) =>
                `${m.title} @ ${Math.round(m.confidence * 100)}% - ${m.reason}`,
            )
            .join('\n')
        : '(none)',
    ];
    return lines.join('\n');
  }
}

export function createObservabilityEngine(): ObservabilityEngine {
  return new ObservabilityEngine();
}

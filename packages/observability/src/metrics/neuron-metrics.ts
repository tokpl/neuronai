import type { NeuronMetricsSnapshot } from '../tracing/types.js';
import { nowIso } from '../tracing/types.js';
import { globalMetrics } from '../metrics.js';

/**
 * Product-facing Neuron latency / size metrics (local only).
 */
export class NeuronMetrics {
  private scanTimeMs = 0;
  private retrievalLatencyMs = 0;
  private graphQueryMs = 0;
  private memorySize = 0;
  private modelLatencyMs = 0;

  recordScan(ms: number): void {
    this.scanTimeMs = Math.max(0, Math.round(ms));
  }

  recordRetrieval(ms: number): void {
    this.retrievalLatencyMs = Math.max(0, Math.round(ms));
  }

  recordGraphQuery(ms: number): void {
    this.graphQueryMs = Math.max(0, Math.round(ms));
  }

  recordMemorySize(count: number): void {
    this.memorySize = Math.max(0, Math.round(count));
  }

  recordModelLatency(ms: number): void {
    this.modelLatencyMs = Math.max(0, Math.round(ms));
  }

  snapshot(): NeuronMetricsSnapshot {
    return {
      scanTimeMs: this.scanTimeMs,
      retrievalLatencyMs: this.retrievalLatencyMs,
      graphQueryMs: this.graphQueryMs,
      memorySize: this.memorySize,
      modelLatencyMs: this.modelLatencyMs,
      counters: globalMetrics.snapshot(),
      at: nowIso(),
    };
  }
}

export function createNeuronMetrics(): NeuronMetrics {
  return new NeuronMetrics();
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AIModelTrace,
  MemoryUsageTrace,
  NeuronTrace,
  ObservabilityStoreDocument,
  ReasoningTrace,
  TraceRetentionPolicy,
} from './types.js';
import { DEFAULT_RETENTION, nowIso } from './types.js';

const STORE_FILE = 'traces.json';

export class TraceStore {
  private doc: ObservabilityStoreDocument = emptyDoc();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, STORE_FILE), 'utf8'),
      ) as ObservabilityStoreDocument;
      this.doc = {
        ...emptyDoc(),
        ...raw,
        retention: { ...DEFAULT_RETENTION, ...raw.retention },
      };
      this.applyRetention();
    } catch {
      this.doc = emptyDoc();
    }
  }

  async save(neuronDir: string): Promise<string> {
    this.applyRetention();
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, STORE_FILE);
    this.doc.updatedAt = nowIso();
    await writeFile(path, `${JSON.stringify(this.doc, null, 2)}\n`, 'utf8');
    return path;
  }

  getDocument(): ObservabilityStoreDocument {
    return this.doc;
  }

  setDebugMode(on: boolean): void {
    this.doc.debugMode = on;
  }

  isDebugMode(): boolean {
    return this.doc.debugMode === true;
  }

  setRetention(policy: Partial<TraceRetentionPolicy>): TraceRetentionPolicy {
    this.doc.retention = { ...this.doc.retention, ...policy };
    this.applyRetention();
    return { ...this.doc.retention };
  }

  getRetention(): TraceRetentionPolicy {
    return { ...this.doc.retention };
  }

  recordTrace(trace: NeuronTrace): void {
    if (this.doc.retention.mode === 'disable') return;
    this.doc.traces.unshift(trace);
    this.applyRetention();
  }

  recordReasoning(trace: ReasoningTrace): void {
    if (this.doc.retention.mode === 'disable') return;
    this.doc.reasoning.unshift(trace);
    this.applyRetention();
  }

  recordMemoryUsage(trace: MemoryUsageTrace): void {
    if (this.doc.retention.mode === 'disable') return;
    this.doc.memoryUsage.unshift(trace);
  }

  recordModel(trace: AIModelTrace): void {
    if (this.doc.retention.mode === 'disable') return;
    this.doc.modelTraces.unshift(trace);
  }

  lastTrace(): NeuronTrace | undefined {
    return this.doc.traces[0];
  }

  lastReasoning(neuronTraceId?: string): ReasoningTrace | undefined {
    if (neuronTraceId) {
      return this.doc.reasoning.find((r) => r.neuronTraceId === neuronTraceId);
    }
    return this.doc.reasoning[0];
  }

  lastMemoryUsage(neuronTraceId?: string): MemoryUsageTrace | undefined {
    if (neuronTraceId) {
      return this.doc.memoryUsage.find((m) => m.neuronTraceId === neuronTraceId);
    }
    return this.doc.memoryUsage[0];
  }

  lastModel(neuronTraceId?: string): AIModelTrace | undefined {
    if (neuronTraceId) {
      return this.doc.modelTraces.find((m) => m.neuronTraceId === neuronTraceId);
    }
    return this.doc.modelTraces[0];
  }

  private applyRetention(): void {
    const { mode, maxTraces, temporaryHours } = this.doc.retention;
    if (mode === 'disable') {
      this.doc.traces = [];
      this.doc.reasoning = [];
      this.doc.memoryUsage = [];
      this.doc.modelTraces = [];
      return;
    }
    if (mode === 'temporary') {
      const cutoff = Date.now() - temporaryHours * 3600_000;
      this.doc.traces = this.doc.traces.filter((t) => Date.parse(t.timestamp) >= cutoff);
      const keepIds = new Set(this.doc.traces.map((t) => t.id));
      this.doc.reasoning = this.doc.reasoning.filter((r) => keepIds.has(r.neuronTraceId));
      this.doc.memoryUsage = this.doc.memoryUsage.filter((m) => keepIds.has(m.neuronTraceId));
      this.doc.modelTraces = this.doc.modelTraces.filter((m) => keepIds.has(m.neuronTraceId));
    }
    this.doc.traces = this.doc.traces.slice(0, maxTraces);
    this.doc.reasoning = this.doc.reasoning.slice(0, maxTraces);
    this.doc.memoryUsage = this.doc.memoryUsage.slice(0, maxTraces);
    this.doc.modelTraces = this.doc.modelTraces.slice(0, maxTraces);
    this.doc.metrics = this.doc.metrics.slice(0, 20);
  }
}

function emptyDoc(): ObservabilityStoreDocument {
  return {
    version: 1,
    debugMode: false,
    retention: { ...DEFAULT_RETENTION },
    traces: [],
    reasoning: [],
    memoryUsage: [],
    modelTraces: [],
    metrics: [],
    updatedAt: nowIso(),
  };
}

export function createTraceStore(): TraceStore {
  return new TraceStore();
}

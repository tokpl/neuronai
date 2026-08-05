import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';

import {
  createObservabilityEngine,
  createNeuronTrace,
  filterTraceText,
  createRetrievalDebugger,
  createNeuronMetrics,
  createReasoningTrace,
  formatReasoningPath,
} from '../src/index.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function tmpNeuron(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'neuron-obs-'));
  dirs.push(d);
  return d;
}

describe('trace model', () => {
  it('creates NeuronTrace with confidence clamp', () => {
    const t = createNeuronTrace({
      operation: 'retrieve',
      durationMs: 12.7,
      inputType: 'query',
      outputType: 'context',
      confidence: 1.5,
      contextSources: ['memory:payment'],
    });
    expect(t.id).toMatch(/^ntr_/);
    expect(t.durationMs).toBe(13);
    expect(t.confidence).toBe(1);
  });

  it('builds reasoning path stages', () => {
    const r = createReasoningTrace({
      neuronTraceId: 'ntr_1',
      userRequest: 'Why Redis?',
      selectedMemories: ['Cache decision'],
      rulesApplied: ['no-cloud-db'],
      finalResponse: 'Use Redis for session cache',
      finalConfidence: 0.91,
    });
    const path = formatReasoningPath(r);
    expect(path).toContain('user_request');
    expect(path).toContain('↓');
    expect(path).toContain('final_response');
  });
});

describe('filters', () => {
  it('redacts secrets and omits code fences', () => {
    const out = filterTraceText(
      'key sk-abcdefghijklmnopqrstuvwxyz123456 and ```\nsecret code\n```',
    );
    expect(out.toLowerCase()).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
    expect(out).toContain('[CODE_OMITTED]');
  });
});

describe('debug + metrics', () => {
  it('retrieval debugger counts found/selected', () => {
    const dbg = createRetrievalDebugger();
    const snap = dbg.snapshot({
      query: 'payment',
      candidates: Array.from({ length: 100 }, (_, i) => ({
        title: `m${i}`,
        score: 1 - i * 0.01,
      })),
      selected: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
    });
    expect(snap.candidateCount).toBe(100);
    expect(snap.selectedCount).toBe(8);
    expect(dbg.format(snap)).toContain('Found:');
  });

  it('neuron metrics snapshot', () => {
    const m = createNeuronMetrics();
    m.recordScan(120);
    m.recordRetrieval(40);
    m.recordGraphQuery(15);
    m.recordMemorySize(42);
    m.recordModelLatency(200);
    const s = m.snapshot();
    expect(s.scanTimeMs).toBe(120);
    expect(s.memorySize).toBe(42);
  });
});

describe('observability engine', () => {
  it('persists traces as JSON and explains last', async () => {
    const dir = await tmpNeuron();
    const eng = createObservabilityEngine();
    eng.setDebugMode(true);
    eng.recordOperation({
      trace: {
        operation: 'recommend architecture',
        operationKind: 'decide',
        durationMs: 88,
        inputType: 'task',
        outputType: 'recommendation',
        confidence: 0.91,
        contextSources: ['graph:payments'],
        summary: 'Use existing service',
      },
      reasoning: {
        userRequest: 'Should we add a new payment service?',
        contextRetrieval: 'Deep search payment',
        selectedMemories: ['Payment architecture decision'],
        graphTraversal: 'payments → checkout → ledger',
        rulesApplied: ['prefer-existing-module'],
        modelGeneration: 'local-offline',
        finalResponse: 'Use existing service',
        finalConfidence: 0.91,
      },
      memories: [
        {
          title: 'Payment architecture decision',
          confidence: 0.96,
          reason: 'Related module dependency.',
        },
      ],
      model: {
        provider: 'offline',
        model: 'none',
        tokensInput: 0,
        tokensOutput: 0,
        latencyMs: 5,
        success: true,
      },
      retrieval: {
        query: 'payment service',
        candidates: [
          { title: 'Payment architecture decision', score: 0.96 },
          { title: 'Checkout flow', score: 0.7 },
        ],
        selected: ['Payment architecture decision'],
      },
      decision: {
        recommendation: 'Use existing service',
        evidence: ['payments module', 'checkout module', 'ledger module'],
        confidence: 0.91,
        modules: 3,
      },
    });

    await eng.save(dir);
    const raw = JSON.parse(await readFile(join(dir, 'traces.json'), 'utf8')) as {
      debugMode: boolean;
      traces: unknown[];
    };
    expect(raw.debugMode).toBe(true);
    expect(raw.traces).toHaveLength(1);

    const explained = eng.explainLast();
    expect(explained.trace?.operation).toContain('recommend');
    expect(explained.reasoningPath).toContain('user_request');
    expect(explained.reportMarkdown).toContain('## Confidence');

    const report = await eng.writeReport(dir);
    expect(report).toContain('neuron-report.md');

    eng.setRetention({ mode: 'disable' });
    expect(eng.lastTrace()).toBeUndefined();
    eng.recordOperation({
      trace: {
        operation: 'should not persist',
        durationMs: 1,
        inputType: 'x',
        outputType: 'y',
      },
    });
    expect(eng.lastTrace()).toBeUndefined();
  });

  it('debug session is verbose when ON', () => {
    const eng = createObservabilityEngine();
    expect(eng.isDebugMode()).toBe(false);
    eng.setDebugMode(true);
    eng.recordOperation({
      trace: {
        operation: 'scan',
        operationKind: 'scan',
        durationMs: 10,
        inputType: 'repo',
        outputType: 'brain',
      },
    });
    const session = eng.debugSessionSummary();
    expect(session).toContain('Debug mode: ON');
    expect(session).toContain('Verbose reasoning');
  });
});

import { describe, expect, it } from 'vitest';

import { MockAIProvider } from '@neuron-ai-memory/ai-provider';
import { InMemoryEmbeddingStore, MockEmbeddingProvider } from '@neuron-ai-memory/embeddings';
import { createInMemoryMemoryEngine } from '@neuron-ai-memory/memory-engine';

import {
  ConflictDetector,
  HybridMemorySearchEngine,
  ImportanceEngine,
  ImportancePolicy,
  MemoryClassifier,
  MemoryConsolidator,
  MemoryEvaluation,
  MemoryExtractor,
  createMemoryIntelligencePipeline,
} from '../src/index.js';

describe('MemoryClassifier + Extractor', () => {
  it('classifies architecture decisions', async () => {
    const classifier = new MemoryClassifier(new MockAIProvider());
    const result = await classifier.classify(
      'We decided to use RBAC instead of hardcoded permissions.',
    );
    expect(result.label).toBe('ARCHITECTURE_DECISION');
    expect(result.memoryType).toBe('architecture_decision');
  });

  it('extracts a structured candidate', async () => {
    const ai = new MockAIProvider();
    const extractor = new MemoryExtractor(new MemoryClassifier(ai), ai);
    const candidates = await extractor.extract({
      text: 'Przenieśliśmy auth do osobnego modułu because we want independent scaling.',
      source: 'user',
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.type).toBe('architecture_decision');
    expect(candidates[0]?.confidence).toBeGreaterThan(0.5);
  });
});

describe('ImportanceEngine', () => {
  it('scores decisions high and context low', () => {
    const engine = new ImportanceEngine(new ImportancePolicy());
    const decision = engine.score({
      type: 'architecture_decision',
      content: 'Use Postgres for relational integrity and versioning.',
      source: 'manual',
      confidence: 0.9,
    });
    const context = engine.score({
      type: 'context',
      content: 'tmp debugging session note',
      source: 'agent',
      confidence: 0.4,
    });
    expect(decision.score).toBeGreaterThan(0.85);
    expect(decision.action).toBe('auto_save');
    expect(context.action).toBe('reject');
  });
});

describe('ConflictDetector', () => {
  it('detects redux → zustand migration', () => {
    const detector = new ConflictDetector();
    const report = detector.detect(
      {
        type: 'knowledge',
        title: 'State library',
        content: 'Project is migrating to Zustand for state management.',
        confidence: 0.9,
      },
      [
        {
          id: '1',
          projectId: 'p',
          type: 'knowledge',
          title: 'State library',
          content: 'Project uses Redux for state management.',
          importanceScore: 0.7,
          confidenceScore: 0.8,
          freshnessScore: 1,
          source: 'manual',
          status: 'active',
          version: 1,
          tags: [],
          usageCount: 0,
          lastUsedAt: null,
          embeddingId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    );
    expect(report.kind).toBe('migration');
    expect(report.recommendation).toBe('supersede');
  });
});

describe('MemoryIntelligencePipeline + search', () => {
  it('stores valuable knowledge from raw input', async () => {
    const mem = createInMemoryMemoryEngine();
    const embeddings = new MockEmbeddingProvider();
    const store = new InMemoryEmbeddingStore();
    const searchEngine = new HybridMemorySearchEngine(mem.memories, embeddings, store);
    const pipeline = createMemoryIntelligencePipeline({
      engine: mem,
      ai: new MockAIProvider(),
      searchEngine,
    });

    const projectId = '22222222-2222-2222-2222-222222222222';
    const result = await pipeline.process({
      projectId,
      kind: 'conversation',
      text: 'We moved authentication into a separate module because we want to scale login independently.',
      autoPersistAskUser: true,
    });

    expect(result.results.some((r) => r.status === 'stored')).toBe(true);
    const stored = result.results.find((r) => r.memory)?.memory;
    expect(stored?.type).toBe('architecture_decision');

    const hits = await searchEngine.search({
      projectId,
      query: 'authentication module scaling',
      limit: 5,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.memory.id).toBe(stored?.id);
  });
});

describe('MemoryConsolidator + Evaluation', () => {
  it('groups near-duplicate memories', () => {
    const consolidator = new MemoryConsolidator();
    const base = {
      projectId: 'p',
      type: 'pattern' as const,
      importanceScore: 0.7,
      confidenceScore: 0.8,
      freshnessScore: 1,
      source: 'manual' as const,
      status: 'active' as const,
      version: 1,
      tags: [],
      usageCount: 0,
      lastUsedAt: null,
      embeddingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const groups = consolidator.findGroups([
      { ...base, id: '1', title: 'API uses REST', content: 'API uses REST' },
      {
        ...base,
        id: '2',
        title: 'API uses REST',
        content: 'All endpoints are REST',
        importanceScore: 0.8,
      },
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0]?.duplicates.length).toBe(1);
  });

  it('computes evaluation metrics', () => {
    const evaluation = new MemoryEvaluation();
    const report = evaluation.evaluate({
      memories: [
        {
          id: '1',
          projectId: 'p',
          type: 'knowledge',
          title: 'A',
          content: 'A',
          importanceScore: 0.8,
          confidenceScore: 0.8,
          freshnessScore: 1,
          source: 'manual',
          status: 'active',
          version: 1,
          tags: [],
          usageCount: 2,
          lastUsedAt: null,
          embeddingId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      conflictCount: 0,
    });
    expect(report.usefulnessScore).toBeGreaterThan(0);
    expect(report.duplicateRate).toBe(0);
  });
});

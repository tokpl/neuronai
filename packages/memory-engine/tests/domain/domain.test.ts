import { describe, expect, it } from 'vitest';

import {
  ConfidenceScore,
  DefaultImportanceCalculator,
  Memory,
  MemoryImportance,
  MemorySource,
  MemoryStatus,
  MemoryType,
  MemoryVersion,
  MemoryRelation,
  RelationType,
} from '../../src/index.js';

describe('value objects', () => {
  it('rejects invalid memory types', () => {
    expect(() => MemoryType.create('nope')).toThrow(/Invalid memory type/);
  });

  it('clamps importance bounds', () => {
    expect(() => MemoryImportance.create(1.2)).toThrow(/importanceScore/);
    expect(MemoryImportance.create(0.5).value).toBe(0.5);
  });
});

describe('Memory entity', () => {
  it('creates and serializes a memory', () => {
    const memory = Memory.create({
      id: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      type: MemoryType.create('architecture_decision'),
      title: 'Use RBAC',
      content: 'Permissions use RBAC instead of hardcoded checks.',
      importance: MemoryImportance.create(0.9),
      confidence: ConfidenceScore.create(0.8),
      source: MemorySource.create('manual'),
    });

    expect(memory.status.value).toBe('active');
    expect(memory.toRecord().type).toBe('architecture_decision');
  });

  it('versions on update and archives', () => {
    const memory = Memory.create({
      id: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      type: MemoryType.create('knowledge'),
      title: 'State',
      content: 'Uses Redux',
      importance: MemoryImportance.create(0.6),
      confidence: ConfidenceScore.default(),
      source: MemorySource.manual(),
    });

    memory.applyUpdate({ content: 'Uses Zustand' });
    expect(memory.version).toBe(2);
    expect(memory.content).toBe('Uses Zustand');

    memory.archive();
    expect(memory.status.value).toBe('archived');
  });
});

describe('ImportanceCalculator', () => {
  it('scores decisions higher than context', () => {
    const calc = new DefaultImportanceCalculator();
    const decision = calc.calculate({
      type: 'architecture_decision',
      contentLength: 120,
      source: 'manual',
    });
    const context = calc.calculate({
      type: 'context',
      contentLength: 120,
      source: 'agent',
    });
    expect(decision).toBeGreaterThan(context);
  });

  it('honors manual importance override', () => {
    const calc = new DefaultImportanceCalculator();
    expect(
      calc.calculate({
        type: 'context',
        contentLength: 10,
        source: 'agent',
        manualImportance: 0.99,
      }),
    ).toBe(0.99);
  });
});

describe('versioning and relations entities', () => {
  it('creates a memory version', () => {
    const version = MemoryVersion.create({
      id: '33333333-3333-3333-3333-333333333333',
      memoryId: '11111111-1111-1111-1111-111111111111',
      version: 2,
      title: 'State',
      content: 'Uses Zustand',
      reason: 'migration',
      createdBy: MemorySource.manual(),
    });
    expect(version.toRecord().version).toBe(2);
  });

  it('rejects self-relations', () => {
    expect(() =>
      MemoryRelation.create({
        id: '44444444-4444-4444-4444-444444444444',
        projectId: '22222222-2222-2222-2222-222222222222',
        fromMemoryId: '11111111-1111-1111-1111-111111111111',
        toMemoryId: '11111111-1111-1111-1111-111111111111',
        relationType: RelationType.create('depends_on'),
      }),
    ).toThrow(/itself/);
  });

  it('exposes MemoryStatus helpers', () => {
    expect(MemoryStatus.active().isActive()).toBe(true);
    expect(MemoryStatus.superseded().isActive()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  createArchitectureDriftDetector,
  createContinuousProjectIntelligence,
  createFileChangeAnalyzer,
  createGitIntelligence,
  createMemorySuggestionEngine,
  createProjectEventBus,
  createSensitiveChangeFilter,
  createChangeImportanceAnalyzer,
} from '../src/index.js';

describe('events', () => {
  it('emits and records project events', () => {
    const bus = createProjectEventBus();
    const seen: string[] = [];
    bus.on('FILE_CHANGED', (e) => seen.push(e.path ?? ''));
    bus.emit('FILE_CHANGED', { path: 'src/AuthService.ts' });
    expect(seen).toEqual(['src/AuthService.ts']);
    expect(bus.recent(1)[0]?.type).toBe('FILE_CHANGED');
  });
});

describe('file + git analysis', () => {
  it('explains AuthService change impact', () => {
    const analyzer = createFileChangeAnalyzer();
    const insight = analyzer.analyze({
      id: '1',
      type: 'FILE_CHANGED',
      at: new Date().toISOString(),
      path: 'src/services/AuthService.ts',
    });
    expect(insight?.summary).toMatch(/Authentication/i);
    expect(insight?.affected).toEqual(expect.arrayContaining(['Login flow', 'Permissions']));
  });

  it('analyzes payment refunds commit', () => {
    const git = createGitIntelligence();
    const insight = git.analyzeCommitMessage('Add payment refunds', [
      'src/payments/RefundService.ts',
      'src/payments/PaymentService.ts',
    ]);
    expect(insight.changedModules).toEqual(expect.arrayContaining(['Payment']));
    expect(insight.related).toEqual(expect.arrayContaining(['Transactions', 'Notifications']));
    expect(insight.suggestion).toMatch(/memory/i);
  });
});

describe('drift detection', () => {
  it('flags business logic in controllers', () => {
    const drift = createArchitectureDriftDetector();
    const findings = drift.inspect(
      'src/controllers/OrderController.ts',
      'export class OrderController { async create() { await prisma.order.create({}); } }',
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.message).toMatch(/Architecture violation/);
  });
});

describe('suggestions + continuous facade', () => {
  it('suggests memories and tracks live health', () => {
    const intel = createContinuousProjectIntelligence();
    intel.noteFileChange('src/payments/RefundService.ts', 'changed', 'Add refunds');
    const pending = intel.pendingMemories();
    expect(pending.some((p) => /refund/i.test(p.title))).toBe(true);
    expect(pending.every((p) => p.requiresApproval)).toBe(true);

    const drift = intel.checkDrift(
      'src/controllers/PayController.ts',
      'await prisma.payment.create({})',
    );
    expect(drift.length).toBeGreaterThan(0);

    const health = intel.liveHealth();
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.openDrift).toBeGreaterThan(0);
  });

  it('filters secrets and low importance noise', () => {
    expect(createSensitiveChangeFilter().isSensitive('.env')).toBe(true);
    expect(createChangeImportanceAnalyzer().classify('README.md')).toBe('LOW');
    expect(createChangeImportanceAnalyzer().classify('schema.prisma')).toBe('HIGH');
  });

  it('builds cursor rule suggestion from drift via suggestion engine', () => {
    const engine = createMemorySuggestionEngine();
    const sug = engine.fromDrift({
      id: 'd1',
      rule: 'All business logic belongs in services',
      evidence: 'prisma.order.create',
      path: 'OrderController.ts',
      severity: 'high',
      message: 'Architecture violation detected',
    });
    expect(sug[0]!.kind).toBe('cursor_rule');
    expect(sug[0]!.requiresApproval).toBe(true);
  });
});

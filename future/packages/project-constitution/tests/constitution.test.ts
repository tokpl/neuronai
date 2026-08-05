import { describe, expect, it } from 'vitest';

import {
  createPatternMiner,
  createProjectConstitutionService,
  createRuleApprovalFlow,
  createRuleGenerator,
  validateRuleCandidate,
} from '../src/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MemoryRecord } from '@neuron-ai-memory/types';

const sampleMemory = (partial: Partial<MemoryRecord>): MemoryRecord => ({
  id: partial.id ?? 'm1',
  projectId: 'p',
  type: partial.type ?? 'architecture_decision',
  title: partial.title ?? 'Use service layer',
  content:
    partial.content ??
    'Decision: Use service layer for business logic\nReason: Keep controllers thin',
  importanceScore: 0.9,
  confidenceScore: 0.9,
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
  ...partial,
});

describe('rule generation', () => {
  it('suggests rules from architecture decisions and mistakes', () => {
    const gen = createRuleGenerator();
    const suggestions = gen.fromMemories([
      sampleMemory({}),
      sampleMemory({
        id: 'm2',
        type: 'mistake',
        title: 'Do not bypass PermissionService',
        content: 'Bypassing permission checks caused auth bugs',
      }),
    ]);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.rule.status === 'suggested')).toBe(true);
    expect(suggestions.every((s) => s.rule.severity !== 'CRITICAL')).toBe(true);
  });
});

describe('pattern detection', () => {
  it('detects service-oriented modules', () => {
    const miner = createPatternMiner();
    const patterns = miner.mine([
      'UserService.ts',
      'PaymentService.ts',
      'VehicleService.ts',
      'OrderService.ts',
      'src/foo.ts',
    ]);
    expect(patterns.some((p) => p.kind === 'service_module')).toBe(true);
    expect(patterns[0]!.count).toBeGreaterThanOrEqual(3);
  });
});

describe('constitution validation + approval', () => {
  it('blocks auto-activating CRITICAL generated rules', () => {
    const issues = validateRuleCandidate({
      severity: 'CRITICAL',
      source: 'generated',
      status: 'active',
      rule: 'Never bypass auth',
    });
    expect(issues.some((i) => i.code === 'CRITICAL_AUTO_ACTIVATE' || i.code === 'CRITICAL_REQUIRES_MANUAL')).toBe(
      true,
    );
  });

  it('suggest → approve → activate flow', () => {
    const flow = createRuleApprovalFlow();
    const gen = createRuleGenerator();
    const [s] = gen.fromMemories([sampleMemory({})]);
    expect(s).toBeTruthy();
    let doc = {
      version: 1 as const,
      projectId: 'p',
      projectName: 'demo',
      updatedAt: new Date().toISOString(),
      rules: [],
      decisions: [],
      mistakes: [],
      techDebt: [],
    };
    doc = flow.suggest(doc, s!.rule);
    expect(doc.rules[0]!.status).toBe('suggested');
    doc = flow.accept(doc, doc.rules[0]!.id);
    expect(doc.rules[0]!.status).toBe('active');
  });
});

describe('evolution service', () => {
  it('persists constitution and generates cursor rules', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neuron-const-'));
    const neuronDir = join(dir, '.neuron');
    try {
      const svc = createProjectConstitutionService({
        neuronDir,
        projectId: 'p1',
        projectName: 'ShopLite',
        projectRoot: dir,
      });
      const { suggestions } = await svc.suggestRules(
        [
          sampleMemory({}),
          sampleMemory({
            id: 'm3',
            type: 'mistake',
            title: 'No direct DB from controllers',
            content: 'Controllers must use packages/db',
          }),
        ],
        ['UserService.ts', 'PaymentService.ts', 'VehicleService.ts'],
      );
      expect(suggestions.length).toBeGreaterThan(0);
      const rules = await svc.getRules();
      expect(rules.markdown).toMatch(/Project Constitution/);

      const first = rules.document.rules.find((r) => r.status === 'suggested');
      expect(first).toBeTruthy();
      await svc.acceptRule(first!.id);
      const cursor = await svc.generateCursorRules();
      expect(cursor.path).toMatch(/project-architecture\.mdc$/);
      expect(cursor.content).toMatch(/Always follow project architecture rules/);

      const health = await svc.projectHealth([sampleMemory({})]);
      expect(health.score).toBeGreaterThan(0);
      expect(health.summary).toMatch(/Project Health/);

      const evo = await svc.reviewEvolution({ commitsSinceReview: 50, fileNames: ['UserService.ts'] });
      expect(evo.message.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

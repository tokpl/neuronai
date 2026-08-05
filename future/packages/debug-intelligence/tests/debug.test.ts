import { describe, expect, it } from 'vitest';

import {
  createDebugIntelligence,
  createIncidentMemoryFactory,
  createIncidentRegistry,
  createIncidentTimeline,
  createRegressionAnalyzer,
  createRootCauseAnalyzer,
} from '../src/index.js';

describe('incident creation + resolution', () => {
  it('creates and resolves into incident memory', () => {
    const reg = createIncidentRegistry();
    const inc = reg.create({
      title: 'Users randomly logged out',
      description: 'Users randomly logged out during sessions',
      severity: 'HIGH',
      affectedModules: ['Auth'],
    });
    expect(inc.status).toBe('OPEN');

    const resolved = reg.resolve(inc.id, {
      rootCause: 'JWT refresh token expiration mismatch',
      solution: 'Unified token lifetime configuration',
      lesson: 'Authentication configuration must stay centralized',
      preventiveActions: ['Centralize auth config'],
    });
    expect(resolved.status).toBe('RESOLVED');

    const mem = createIncidentMemoryFactory().fromResolved(resolved);
    expect(mem.lesson).toMatch(/centralized/i);
    expect(mem.rootCause).toMatch(/JWT/i);
  });
});

describe('root cause analysis', () => {
  it('ranks migration mismatch highly for schema signals', () => {
    const report = createRootCauseAnalyzer().analyze({
      query: 'API returns 500 after deploy',
      errorMessage: 'column does not exist',
      changedFiles: ['prisma/migrations/20260805_add_refunds/migration.sql'],
    });
    expect(report.causes[0]!.cause).toMatch(/migration/i);
    expect(report.causes[0]!.confidence).toBeGreaterThan(0.7);
  });
});

describe('similarity / regression', () => {
  it('detects similar payment timeout incidents', () => {
    const reg = createIncidentRegistry();
    const prior = reg.create({
      title: 'Payment timeout',
      description: 'Payment timeout on checkout',
    });
    reg.resolve(prior.id, {
      rootCause: 'Stripe upstream latency',
      solution: 'Added retry with backoff',
    });
    const matches = createRegressionAnalyzer().findSimilar('Payment timeout on refunds', reg.list());
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.message).toMatch(/Similar incident/i);
  });
});

describe('fix validation + timeline', () => {
  it('requires human confirm and records timeline chain', () => {
    const intel = createDebugIntelligence();
    const inc = intel.createIncident({
      title: 'Users randomly logged out',
      description: 'JWT issues',
    });
    intel.resolveIncident(inc.id, {
      rootCause: 'JWT refresh token expiration mismatch',
      solution: 'Unified token lifetime configuration',
      lesson: 'Authentication configuration must stay centralized',
    });
    const validation = intel.validateFix(inc.id, 'Unified JWT lifetimes in AuthConfig', [
      'src/auth/AuthConfig.ts',
    ]);
    expect(validation.requiresHumanConfirm).toBe(true);

    const tl = createIncidentTimeline();
    tl.recordChain({
      feature: 'Auth refresh tokens',
      bug: 'Users randomly logged out',
      commit: 'Changed AuthService',
      incident: 'Users randomly logged out',
      fix: 'Unified token lifetime',
    });
    expect(tl.markdown()).toMatch(/Feature created/);
    expect(tl.markdown()).toMatch(/Fix deployed/);
  });
});

describe('debug context', () => {
  it('builds debug session with causes and priors', () => {
    const intel = createDebugIntelligence();
    intel.createIncident({
      title: 'Payment timeout',
      description: 'timeout talking to provider',
    });
    const ctx = intel.debugContext({
      query: 'API returns 500 error on payments',
      errorMessage: 'Timeout waiting for stripe',
      changedFiles: ['src/payments/PaymentService.ts'],
    });
    expect(ctx.possibleCauses.length).toBeGreaterThan(0);
    expect(ctx.note).toMatch(/does not auto-fix/i);
  });
});

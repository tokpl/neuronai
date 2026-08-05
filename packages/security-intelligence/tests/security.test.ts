import { describe, expect, it } from 'vitest';

import {
  createAuthorizationAnalyzer,
  createChangeSecurityAnalyzer,
  createSecurityIntelligence,
  createSecretDetector,
  createThreatModelGenerator,
} from '../src/index.js';

describe('secret detection', () => {
  it('detects API keys without storing values', () => {
    const findings = createSecretDetector().detect({
      path: 'src/config.ts',
      content: 'const apiKey = "sk_live_THIS_SHOULD_NOT_BE_STORED_12345";\n',
    });
    expect(findings.length).toBeGreaterThan(0);
    const json = JSON.stringify(findings);
    expect(json).not.toMatch(/THIS_SHOULD_NOT_BE_STORED/);
    expect(findings[0]!.evidence).toMatch(/redacted/i);
    expect(findings[0]!.location).toMatch(/config\.ts/);
  });
});

describe('authorization', () => {
  it('flags DELETE without authz as high risk', () => {
    const risk = createAuthorizationAnalyzer().analyzeEndpoint({
      method: 'DELETE',
      path: '/users/:id',
      context: 'router.delete("/users/:id", handler)',
    });
    expect(risk.hasAuthentication).toBe(false);
    expect(risk.hasAuthorization).toBe(false);
    expect(['HIGH', 'CRITICAL']).toContain(risk.risk);
  });
});

describe('security memory', () => {
  it('stores type/location/recommendation without secrets', () => {
    const intel = createSecurityIntelligence();
    const mem = intel.remember({
      type: 'SECRET',
      description: 'Detected API_KEY pattern',
      location: '.env:3',
      recommendation: 'Move to secret manager',
      severity: 'HIGH',
    });
    expect(mem.status).toBe('OPEN');
    expect(intel.securityHistory('API_KEY')[0]!.id).toBe(mem.id);
  });
});

describe('threat model', () => {
  it('generates assets, entry points, and risks', () => {
    const model = createThreatModelGenerator().generate({
      architectureNotes: ['API with Auth and Admin modules; Stripe payments'],
      modules: ['Auth', 'Admin', 'Payment'],
      assets: ['User data'],
      entryPoints: ['API'],
    });
    expect(model.assets[0]!.name).toBe('User data');
    expect(model.entryPoints.some((e) => e.name === 'API')).toBe(true);
    expect(model.risks[0]!.risk).toMatch(/Unauthorized/i);
  });
});

describe('diff / change review', () => {
  it('scores auth-related diffs as elevated impact', () => {
    const impact = createChangeSecurityAnalyzer().analyze({
      diff: '+ export function requireAdmin() {}\n+ jwt.verify(token)',
      changedPaths: ['src/auth/middleware.ts'],
      securityRules: ['All admin actions require audit logging.'],
      previousIncidents: [
        { id: 'inc_1', title: 'Missing permission check on admin', description: 'admin auth' },
      ],
    });
    expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(impact.impact);
    expect(impact.reasons.some((r) => /auth/i.test(r))).toBe(true);
  });
});

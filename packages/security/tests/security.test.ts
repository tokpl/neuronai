import { describe, expect, it } from 'vitest';

import {
  createAccessControl,
  createLocalUserPrincipal,
  redactSecrets,
  canSendTelemetry,
  DEFAULT_PRIVACY_CONSENT,
} from '../src/index.js';

describe('AccessControlLayer', () => {
  it('allows local user to purge', () => {
    const acl = createAccessControl(createLocalUserPrincipal());
    expect(acl.can('project:purge').allowed).toBe(true);
  });

  it('denies team member purge', () => {
    const acl = createAccessControl({ id: 't', role: 'TEAM_MEMBER' });
    expect(acl.can('project:purge').allowed).toBe(false);
  });
});

describe('redactSecrets', () => {
  it('redacts api keys and connection strings', () => {
    const raw = 'api_key=sk-abcdefghijklmnop DATABASE_URL=postgresql://u:p@h/db';
    const redacted = redactSecrets(raw);
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('sk-abcdefghijklmnop');
  });
});

describe('privacy consent', () => {
  it('defaults to no telemetry', () => {
    expect(canSendTelemetry(DEFAULT_PRIVACY_CONSENT, 'metrics')).toBe(false);
    expect(canSendTelemetry(DEFAULT_PRIVACY_CONSENT, 'errorReporting')).toBe(false);
  });
});

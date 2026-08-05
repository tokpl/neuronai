/**
 * Default Security Constitution rules — suggested to Project Constitution (human must accept).
 */
export const DEFAULT_SECURITY_RULES: Array<{
  rule: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  rationale: string;
  confidence: number;
}> = [
  {
    rule: 'Secrets must never be committed to source control.',
    severity: 'CRITICAL',
    rationale: 'Leaked secrets enable account takeover and data breaches.',
    confidence: 0.95,
  },
  {
    rule: 'All admin actions require audit logging.',
    severity: 'WARNING',
    rationale: 'Admin mutations need accountability and forensic trail.',
    confidence: 0.9,
  },
  {
    rule: 'All database writes require validation.',
    severity: 'WARNING',
    rationale: 'Unvalidated writes lead to injection and integrity failures.',
    confidence: 0.88,
  },
  {
    rule: 'Destructive API methods (DELETE/PUT) require authentication and authorization checks.',
    severity: 'WARNING',
    rationale: 'Missing authz on mutating endpoints is a common incident class.',
    confidence: 0.9,
  },
  {
    rule: 'Authentication configuration must stay centralized.',
    severity: 'WARNING',
    rationale: 'Split JWT/session lifetimes cause subtle auth bugs and lockouts.',
    confidence: 0.85,
  },
  {
    rule: 'Do not log secrets, tokens, or passwords.',
    severity: 'CRITICAL',
    rationale: 'Logs amplify secret sprawl across environments.',
    confidence: 0.93,
  },
];

export function listDefaultSecurityRules(): typeof DEFAULT_SECURITY_RULES {
  return [...DEFAULT_SECURITY_RULES];
}

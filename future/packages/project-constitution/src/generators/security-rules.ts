import { newRuleId, nowIso, type ConstitutionRule } from '../rules/types.js';
import type { ProjectConstitutionDocument } from '../rules/types.js';
import { createRuleApprovalFlow } from '../validators/approval-flow.js';

/**
 * Baseline Security Constitution rules (suggested — human must accept).
 */
export const BASELINE_SECURITY_RULES: Array<{
  rule: string;
  severity: ConstitutionRule['severity'];
  rationale: string;
  confidence: number;
}> = [
  {
    rule: 'Secrets must never be committed.',
    severity: 'CRITICAL',
    rationale: 'Committed secrets are a primary breach vector.',
    confidence: 0.95,
  },
  {
    rule: 'All admin actions require audit logging.',
    severity: 'WARNING',
    rationale: 'Admin mutations need an accountable trail.',
    confidence: 0.9,
  },
  {
    rule: 'All database writes require validation.',
    severity: 'WARNING',
    rationale: 'Unvalidated writes risk injection and integrity loss.',
    confidence: 0.88,
  },
  {
    rule: 'Destructive endpoints require authentication and authorization.',
    severity: 'WARNING',
    rationale: 'DELETE/PUT without authz is a recurring incident class.',
    confidence: 0.9,
  },
  {
    rule: 'Do not log secrets, tokens, or passwords.',
    severity: 'CRITICAL',
    rationale: 'Logs amplify secret sprawl.',
    confidence: 0.93,
  },
];

export function buildBaselineSecurityRuleCandidates(): ConstitutionRule[] {
  const now = nowIso();
  return BASELINE_SECURITY_RULES.map((r) => ({
    id: newRuleId(),
    category: 'SECURITY' as const,
    rule: r.rule,
    severity: r.severity === 'CRITICAL' ? 'WARNING' : r.severity, // suggest path caps CRITICAL
    confidence: r.confidence,
    source: 'generated' as const,
    status: 'suggested' as const,
    rationale: r.rationale,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Suggest baseline security rules into constitution (idempotent by rule text).
 */
export function suggestBaselineSecurityRules(
  doc: ProjectConstitutionDocument,
): { document: ProjectConstitutionDocument; added: ConstitutionRule[] } {
  const approval = createRuleApprovalFlow();
  let next = doc;
  const added: ConstitutionRule[] = [];
  const existing = new Set(doc.rules.map((r) => r.rule.toLowerCase()));

  for (const candidate of buildBaselineSecurityRuleCandidates()) {
    if (existing.has(candidate.rule.toLowerCase())) continue;
    next = approval.suggest(next, candidate);
    added.push(candidate);
    existing.add(candidate.rule.toLowerCase());
  }

  return { document: next, added };
}

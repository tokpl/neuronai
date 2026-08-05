import type { ConstitutionRule, RuleSeverity, RuleSource } from '../rules/types.js';

export interface ValidationIssue {
  code: string;
  message: string;
  ruleId?: string;
}

/**
 * CRITICAL rules must never be auto-activated from generated/learned sources.
 */
export function validateRuleCandidate(input: {
  severity: RuleSeverity;
  source: RuleSource;
  status: ConstitutionRule['status'];
  rule: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.rule.trim()) {
    issues.push({ code: 'EMPTY_RULE', message: 'Rule text is required' });
  }
  if (
    input.severity === 'CRITICAL' &&
    (input.source === 'generated' || input.source === 'learned') &&
    (input.status === 'suggested' || input.status === 'active')
  ) {
    // Allow suggested CRITICAL only if status stays suggested — block active
    if (input.status === 'active') {
      issues.push({
        code: 'CRITICAL_AUTO_ACTIVATE',
        message:
          'CRITICAL rules cannot be activated automatically from generated/learned sources. Require explicit human approval as manual.',
      });
    }
  }
  if (
    input.severity === 'CRITICAL' &&
    input.source !== 'manual' &&
    input.status === 'active'
  ) {
    issues.push({
      code: 'CRITICAL_REQUIRES_MANUAL',
      message: 'Active CRITICAL rules must have source=manual after human approval.',
    });
  }
  return issues;
}

export function assertCanActivate(rule: ConstitutionRule): void {
  const issues = validateRuleCandidate(rule);
  if (issues.length) {
    throw new Error(issues.map((i) => i.message).join(' '));
  }
}

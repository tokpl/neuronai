import type { ConstitutionRule } from '../rules/types.js';
import { assertCanActivate, validateRuleCandidate } from '../validators/rule-validator.js';
import { nowIso, type ProjectConstitutionDocument } from '../rules/types.js';

/**
 * Generated suggestion → user review → approved → active constitution.
 * Neuron never silently activates CRITICAL rules.
 */
export class RuleApprovalFlow {
  suggest(doc: ProjectConstitutionDocument, rule: ConstitutionRule): ProjectConstitutionDocument {
    const candidate: ConstitutionRule = {
      ...rule,
      status: 'suggested',
      // Cap auto severity: generators should not emit CRITICAL as active path
      severity: rule.severity === 'CRITICAL' ? 'WARNING' : rule.severity,
      updatedAt: nowIso(),
    };
    const issues = validateRuleCandidate(candidate);
    if (issues.some((i) => i.code === 'EMPTY_RULE')) {
      throw new Error(issues[0]!.message);
    }
    return {
      ...doc,
      updatedAt: nowIso(),
      rules: [...doc.rules.filter((r) => r.id !== candidate.id), candidate],
    };
  }

  approve(
    doc: ProjectConstitutionDocument,
    ruleId: string,
    options: { asCritical?: boolean } = {},
  ): ProjectConstitutionDocument {
    const existing = doc.rules.find((r) => r.id === ruleId);
    if (!existing) throw new Error(`Unknown rule: ${ruleId}`);
    if (existing.status === 'rejected') {
      throw new Error('Rejected rules cannot be approved — create a new suggestion');
    }

    const approved: ConstitutionRule = {
      ...existing,
      status: 'approved',
      source: options.asCritical ? 'manual' : existing.source === 'manual' ? 'manual' : existing.source,
      severity: options.asCritical ? 'CRITICAL' : existing.severity,
      updatedAt: nowIso(),
    };

    return {
      ...doc,
      updatedAt: nowIso(),
      rules: doc.rules.map((r) => (r.id === ruleId ? approved : r)),
    };
  }

  activate(doc: ProjectConstitutionDocument, ruleId: string): ProjectConstitutionDocument {
    const existing = doc.rules.find((r) => r.id === ruleId);
    if (!existing) throw new Error(`Unknown rule: ${ruleId}`);
    if (existing.status !== 'approved' && existing.status !== 'active') {
      throw new Error('Activate only after approval (suggested → approved → active)');
    }

    const active: ConstitutionRule = {
      ...existing,
      status: 'active',
      // CRITICAL must be manual
      source: existing.severity === 'CRITICAL' ? 'manual' : existing.source,
      updatedAt: nowIso(),
    };
    assertCanActivate(active);

    return {
      ...doc,
      updatedAt: nowIso(),
      rules: doc.rules.map((r) => (r.id === ruleId ? active : r)),
    };
  }

  reject(doc: ProjectConstitutionDocument, ruleId: string): ProjectConstitutionDocument {
    return {
      ...doc,
      updatedAt: nowIso(),
      rules: doc.rules.map((r) =>
        r.id === ruleId ? { ...r, status: 'rejected' as const, updatedAt: nowIso() } : r,
      ),
    };
  }

  /** Convenience: approve + activate in one human-confirmed step */
  accept(
    doc: ProjectConstitutionDocument,
    ruleId: string,
    options: { asCritical?: boolean } = {},
  ): ProjectConstitutionDocument {
    return this.activate(this.approve(doc, ruleId, options), ruleId);
  }
}

export function createRuleApprovalFlow(): RuleApprovalFlow {
  return new RuleApprovalFlow();
}

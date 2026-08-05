import type {
  ProjectMemoryContext,
  RequirementAnalysis,
  RiskAnalysis,
  RiskLevel,
} from '../types.js';

export class ArchitectureRiskAnalyzer {
  analyze(
    requirement: RequirementAnalysis,
    memory?: ProjectMemoryContext,
  ): RiskAnalysis {
    const breakingChanges: string[] = [];
    const security: string[] = [];
    const performance: string[] = [];
    const maintenance: string[] = [];

    if (requirement.affected.some((a) => /database|user/i.test(a))) {
      breakingChanges.push('Database migration affects existing users / data paths.');
    }
    if (/payment|billing|refund/i.test(requirement.raw + requirement.feature)) {
      security.push('Money-moving flows need authz, idempotency, and audit trails.');
      performance.push('Payment paths may increase write contention on ledger/outbox.');
    }
    if (/auth|permission/i.test(requirement.raw + requirement.feature)) {
      security.push('Auth/permission changes can unlock privilege escalation if incomplete.');
    }
    if (requirement.complexity === 'HIGH') {
      maintenance.push('High complexity increases long-term ownership cost.');
    }
    if ((memory?.mistakes ?? []).some((m) => /bypass|direct db|tenant/i.test(m))) {
      security.push('Prior mistakes warn against bypassing established boundaries.');
    }
    if (!breakingChanges.length && requirement.risk === 'HIGH') {
      breakingChanges.push('Cross-module impact may break implicit contracts.');
    }
    if (!maintenance.length) {
      maintenance.push('New surface area must stay aligned with constitution/patterns.');
    }

    const reasons = [...breakingChanges, ...security, ...performance, ...maintenance];
    const level = elevate(requirement.risk, reasons.length);

    return {
      level,
      reasons: reasons.slice(0, 8),
      categories: { breakingChanges, security, performance, maintenance },
    };
  }
}

function elevate(base: RiskLevel, reasonCount: number): RiskLevel {
  if (base === 'CRITICAL') return 'CRITICAL';
  if (reasonCount >= 5) return 'HIGH';
  return base;
}

export function createArchitectureRiskAnalyzer(): ArchitectureRiskAnalyzer {
  return new ArchitectureRiskAnalyzer();
}

import type {
  ComplexityLevel,
  ProjectMemoryContext,
  RequirementAnalysis,
  RiskLevel,
} from '../types.js';

const DOMAIN_MAP: Record<string, string[]> = {
  payments: ['Users', 'Transactions', 'Database', 'Notifications'],
  payment: ['Users', 'Transactions', 'Database', 'Notifications'],
  marketplace: ['Users', 'Catalog', 'Orders', 'Payments', 'Search', 'Notifications'],
  auth: ['Users', 'Permissions', 'Sessions', 'API'],
  authentication: ['Users', 'Permissions', 'Sessions', 'API'],
  billing: ['Users', 'Payments', 'Invoices', 'Notifications'],
  notification: ['Users', 'Events', 'Email'],
  refund: ['Payments', 'Transactions', 'Notifications', 'Database'],
};

/**
 * Understand the feature request before any design.
 */
export class RequirementAnalyzer {
  analyze(request: string, memory?: ProjectMemoryContext): RequirementAnalysis {
    const raw = request.trim();
    const lower = raw.toLowerCase();
    const feature = detectFeature(lower);
    const affected = detectAffected(lower, feature, memory);
    const complexity = detectComplexity(lower, affected.length);
    const risk = detectRisk(lower, complexity, affected);
    const questions = buildQuestions(feature, affected, memory);

    return { raw, feature, affected, complexity, risk, questions };
  }
}

function detectFeature(t: string): string {
  if (/marketplace|market place/.test(t)) return 'Marketplace';
  if (/refund/.test(t)) return 'Payment refunds';
  if (/payment|płatności|platnosci/.test(t)) return 'Payments';
  if (/notif/.test(t)) return 'Notifications';
  if (/auth|login|jwt/.test(t)) return 'Authentication';
  if (/billing|invoice/.test(t)) return 'Billing';
  if (/permission|rbac/.test(t)) return 'Permissions';
  const m = t.match(/\b(?:add|create|build|implement|design|dodaj)\s+(?:a\s+|an\s+|the\s+)?(.+)$/i);
  if (m) return titleCase(m[1]!.replace(/[.?!].*$/, '').trim()).slice(0, 60) || 'Feature';
  return 'Feature';
}

function detectAffected(
  t: string,
  feature: string,
  memory?: ProjectMemoryContext,
): string[] {
  const set = new Set<string>();
  for (const [key, areas] of Object.entries(DOMAIN_MAP)) {
    if (t.includes(key) || feature.toLowerCase().includes(key)) {
      for (const a of areas) set.add(a);
    }
  }
  for (const m of memory?.modules ?? []) {
    if (t.includes(m.toLowerCase()) || feature.toLowerCase().includes(m.toLowerCase())) {
      set.add(titleCase(m));
    }
  }
  if (!set.size) {
    set.add('Core');
    set.add('API');
    set.add('Database');
  }
  return [...set];
}

function detectComplexity(t: string, affectedCount: number): ComplexityLevel {
  if (/migrat|rewrite|redesign|marketplace|payment system|platform/.test(t) || affectedCount >= 4) {
    return 'HIGH';
  }
  if (/add|create|implement|extend|integrat/.test(t) || affectedCount >= 2) return 'MEDIUM';
  return 'LOW';
}

function detectRisk(t: string, complexity: ComplexityLevel, affected: string[]): RiskLevel {
  if (/security|auth|payment|billing|permission|migrat/.test(t) || complexity === 'HIGH') {
    return 'HIGH';
  }
  if (complexity === 'MEDIUM' || affected.length >= 3) return 'MEDIUM';
  return 'LOW';
}

function buildQuestions(
  feature: string,
  affected: string[],
  memory?: ProjectMemoryContext,
): string[] {
  const q = [
    `What is the success metric for ${feature}?`,
    `Which of [${affected.slice(0, 4).join(', ')}] own the write path?`,
  ];
  if (memory?.decisions?.length) {
    q.push('Does this conflict with any existing architecture decisions?');
  }
  if (/payment|marketplace|billing/i.test(feature)) {
    q.push('Is idempotency / outbox required for money-moving operations?');
  }
  return q;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function createRequirementAnalyzer(): RequirementAnalyzer {
  return new RequirementAnalyzer();
}

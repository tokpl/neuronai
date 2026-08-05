import type {
  ChangeSecurityImpact,
  SecurityMemory,
  SecuritySeverity,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Analyze git-style diffs for security impact (advisor only).
 */
export class ChangeSecurityAnalyzer {
  analyze(input: {
    diff?: string;
    changedPaths?: string[];
    securityRules?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
    modules?: string[];
  }): ChangeSecurityImpact {
    const blob = `${input.diff ?? ''}\n${(input.changedPaths ?? []).join('\n')}`.toLowerCase();
    const reasons: string[] = [];
    const findings: SecurityMemory[] = [];
    const ruleHits: string[] = [];

    const modules = [
      ...new Set([
        ...(input.modules ?? []),
        ...(input.changedPaths ?? []).map(moduleFromPath).filter(Boolean),
      ]),
    ] as string[];

    if (/auth|jwt|session|password|oauth|rbac|permission/.test(blob)) {
      reasons.push('Auth / session related changes');
      findings.push(
        mem('AUTHORIZATION', 'Authentication or authorization surface changed', 'HIGH', modules),
      );
    }
    if (/migration|schema\.prisma|alter table|drop column/.test(blob)) {
      reasons.push('Database schema / migration change');
      findings.push(mem('DATA_ACCESS', 'Data model change may affect access control', 'MEDIUM', modules));
    }
    if (/\.env|secret|apikey|private[_-]?key|credentials/.test(blob)) {
      reasons.push('Possible secret or credential file involvement');
      findings.push(
        mem('SECRET', 'Diff touches secret-adjacent paths or keywords', 'CRITICAL', modules),
      );
    }
    if (/crypto|encrypt|decrypt|bcrypt|hash/.test(blob)) {
      reasons.push('Cryptography-related change');
      findings.push(mem('CRYPTO', 'Crypto usage changed — review algorithms & key handling', 'HIGH', modules));
    }
    if (/cors|csrf|helmet|csp|cookie/.test(blob)) {
      reasons.push('Browser / transport security headers or cookies');
      findings.push(mem('CONFIGURATION', 'Security configuration changed', 'MEDIUM', modules));
    }
    if (/package\.json|pnpm-lock|yarn\.lock|package-lock/.test(blob)) {
      reasons.push('Dependency lockfile / package manifest change');
      findings.push(mem('DEPENDENCY', 'Dependency graph changed', 'MEDIUM', modules));
    }

    for (const rule of input.securityRules ?? []) {
      const key = rule.toLowerCase();
      if (
        (/secret/.test(key) && /secret|\.env|credential/.test(blob)) ||
        (/audit/.test(key) && /admin|delete|role/.test(blob)) ||
        (/validat/.test(key) && /write|insert|update|create/.test(blob)) ||
        (/auth/.test(key) && /auth|admin|permission/.test(blob))
      ) {
        ruleHits.push(rule);
      }
    }

    const relatedIncidents = (input.previousIncidents ?? [])
      .filter((i) => overlap(blob, `${i.title} ${i.description ?? ''}`.toLowerCase()) >= 2)
      .map((i) => `${i.id}: ${i.title}`)
      .slice(0, 8);

    if (relatedIncidents.length) {
      reasons.push(`Related prior incidents: ${relatedIncidents.length}`);
    }
    if (!reasons.length) {
      reasons.push('No strong security signals in diff — still review sensitive paths manually');
    }

    return {
      impact: maxSeverity(findings.map((f) => f.severity)),
      reasons,
      affectedModules: modules.length ? modules : ['Unknown'],
      ruleHits,
      relatedIncidents,
      findings,
    };
  }
}

function mem(
  type: SecurityMemory['type'],
  description: string,
  severity: SecuritySeverity,
  modules: string[],
): SecurityMemory {
  const now = nowIso();
  return {
    id: newId('sm'),
    type,
    description,
    severity,
    confidence: 0.65,
    affectedModules: modules.length ? modules : ['Unknown'],
    resolution: null,
    status: 'OPEN',
    recommendation: 'Human review required — Neuron does not auto-remediate.',
    createdAt: now,
    updatedAt: now,
  };
}

function moduleFromPath(path: string): string {
  const p = path.replace(/\\/g, '/');
  if (/auth/i.test(p)) return 'Auth';
  if (/payment|billing|stripe/i.test(p)) return 'Payment';
  if (/admin/i.test(p)) return 'Admin';
  if (/user/i.test(p)) return 'Users';
  if (/api|route|controller/i.test(p)) return 'API';
  return '';
}

function maxSeverity(severities: SecuritySeverity[]): SecuritySeverity {
  const order: SecuritySeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let best: SecuritySeverity = 'LOW';
  for (const s of severities) {
    if (order.indexOf(s) > order.indexOf(best)) best = s;
  }
  return best;
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  let n = 0;
  for (const t of b.split(/[^a-z0-9]+/)) if (ta.has(t)) n += 1;
  return n;
}

export function createChangeSecurityAnalyzer(): ChangeSecurityAnalyzer {
  return new ChangeSecurityAnalyzer();
}

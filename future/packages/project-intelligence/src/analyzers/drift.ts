import type { ArchitectureDriftFinding } from '../types.js';
import { newId } from '../types.js';

export interface DriftRule {
  id: string;
  rule: string;
  /** Paths that should not contain business logic patterns */
  pathPattern: RegExp;
  /** Content smells */
  contentPattern: RegExp;
  severity: 'warning' | 'high';
}

const DEFAULT_RULES: DriftRule[] = [
  {
    id: 'biz-in-controller',
    rule: 'All business logic belongs in services',
    pathPattern: /controller/i,
    contentPattern:
      /\b(prisma|createQuery|executeSql|transaction\(|stripe\.|bcrypt\.|jwt\.sign)\b/i,
    severity: 'high',
  },
  {
    id: 'db-in-controller',
    rule: 'Controllers must not access the database directly',
    pathPattern: /controller/i,
    contentPattern: /\b(getRepository|EntityManager|knex\.|db\.query|mongoose\.)\b/i,
    severity: 'high',
  },
  {
    id: 'logic-in-route',
    rule: 'Keep route handlers thin — delegate to services',
    pathPattern: /route|router|endpoint/i,
    contentPattern: /\b(if\s*\(.*\)\s*\{[\s\S]{120,}business|calculate|refund|authorize)\b/i,
    severity: 'warning',
  },
];

/**
 * Detect architecture violations vs declared project rules.
 */
export class ArchitectureDriftDetector {
  constructor(private readonly rules: DriftRule[] = DEFAULT_RULES) {}

  inspect(path: string, content: string): ArchitectureDriftFinding[] {
    const findings: ArchitectureDriftFinding[] = [];
    for (const rule of this.rules) {
      if (!rule.pathPattern.test(path)) continue;
      if (!rule.contentPattern.test(content)) continue;
      findings.push({
        id: newId('drift'),
        rule: rule.rule,
        evidence: summarizeEvidence(content, rule.contentPattern),
        path,
        severity: rule.severity,
        message: `Architecture violation detected: ${rule.rule} (${path})`,
      });
    }
    return findings;
  }

  inspectMany(files: Array<{ path: string; content: string }>): ArchitectureDriftFinding[] {
    return files.flatMap((f) => this.inspect(f.path, f.content));
  }
}

function summarizeEvidence(content: string, re: RegExp): string {
  const m = content.match(re);
  if (!m) return 'pattern matched';
  const idx = Math.max(0, (m.index ?? 0) - 20);
  return content.slice(idx, idx + 80).replace(/\s+/g, ' ').trim();
}

export function createArchitectureDriftDetector(rules?: DriftRule[]): ArchitectureDriftDetector {
  return new ArchitectureDriftDetector(rules);
}

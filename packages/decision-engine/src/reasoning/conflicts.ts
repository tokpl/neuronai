import type { EvidenceItem, ReasoningContext } from '../types.js';

export interface ConflictFinding {
  topic: string;
  older: string;
  newer: string;
  recommendation: string;
  explanation: string;
}

/**
 * Detect conflicting decisions / rules — prefer newer explicit decisions.
 */
export class ConflictDetector {
  detect(ctx: ReasoningContext): ConflictFinding[] {
    const findings: ConflictFinding[] = [];
    const decisions = ctx.decisions ?? [];

    const rest = decisions.filter((d) => /\brest\b|http api/i.test(d));
    const gql = decisions.filter((d) => /graphql/i.test(d));
    if (rest.length && gql.length) {
      findings.push({
        topic: 'API style',
        older: rest[rest.length - 1]!,
        newer: gql[0]!,
        recommendation: 'GraphQL',
        explanation:
          'Found conflicting decisions. Older preference leaned REST; newer decisions favor GraphQL. Current recommendation: GraphQL (newer explicit decision wins unless rules forbid it).',
      });
    }

    const sql = decisions.filter((d) => /postgres|postgresql|sql\b/i.test(d));
    const mongo = decisions.filter((d) => /mongo/i.test(d));
    if (sql.length && mongo.length) {
      findings.push({
        topic: 'Database',
        older: mongo[mongo.length - 1]!,
        newer: sql[0]!,
        recommendation: 'PostgreSQL',
        explanation:
          'Found conflicting datastore decisions. Prefer the newer / majority project pattern — typically PostgreSQL when both appear.',
      });
    }

    // Rule vs incident tension
    for (const rule of ctx.rules ?? []) {
      for (const inc of ctx.incidents ?? []) {
        if (overlap(rule, inc) >= 2) {
          findings.push({
            topic: 'Rule vs incident',
            older: rule,
            newer: inc,
            recommendation: 'Follow the rule; treat incident as evidence of past violation risk',
            explanation: `Rule and incident overlap on topic signals. Do not ignore either — encode prevention.`,
          });
        }
      }
    }

    return findings;
  }

  /** Attach conflict evidence items */
  toEvidence(findings: ConflictFinding[]): EvidenceItem[] {
    return findings.map((f) => ({
      kind: 'decision' as const,
      ref: `conflict:${f.topic}`,
      detail: f.explanation,
      weight: 0.88,
    }));
  }
}

function overlap(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3),
  );
  let n = 0;
  for (const t of b.toLowerCase().split(/[^a-z0-9]+/)) if (ta.has(t)) n += 1;
  return n;
}

export function createConflictDetector(): ConflictDetector {
  return new ConflictDetector();
}

import type { Incident, PossibleCause, RootCauseReport } from '../types.js';

export interface RootCauseInput {
  query: string;
  errorMessage?: string;
  stackTrace?: string;
  changedFiles?: string[];
  decisions?: string[];
  previousIncidents?: Incident[];
}

/**
 * Suggest possible root causes with confidence — advisory only.
 */
export class RootCauseAnalyzer {
  analyze(input: RootCauseInput): RootCauseReport {
    const blob = `${input.query}\n${input.errorMessage ?? ''}\n${input.stackTrace ?? ''}`.toLowerCase();
    const files = (input.changedFiles ?? []).map((f) => f.toLowerCase());
    const causes: PossibleCause[] = [];

    if (
      /migration|schema|prisma|column|relation/i.test(blob) ||
      files.some((f) => /migration|schema\.prisma/i.test(f))
    ) {
      causes.push({
        rank: 0,
        cause: 'Database migration mismatch',
        confidence: 0.82,
        evidence: ['schema/migration signals in error or recent files'],
      });
    }

    if (/validat|zod|joi|dto|bad request|400/.test(blob)) {
      causes.push({
        rank: 0,
        cause: 'Validation regression',
        confidence: 0.41,
        evidence: ['validation keywords in error/query'],
      });
    }

    if (/jwt|token|refresh|expir|logout|session|unauthorized|401|403/.test(blob)) {
      causes.push({
        rank: 0,
        cause: 'JWT / session lifetime or auth middleware mismatch',
        confidence: 0.78,
        evidence: ['auth/token keywords'],
      });
    }

    if (/timeout|econn|payment|stripe|504|gateway/.test(blob)) {
      causes.push({
        rank: 0,
        cause: 'Upstream timeout / payment provider latency',
        confidence: 0.7,
        evidence: ['timeout/payment signals'],
      });
    }

    if (/cannot read propert|undefined|null is not|typeerror/.test(blob)) {
      causes.push({
        rank: 0,
        cause: 'Missing initialization or unexpected API shape',
        confidence: 0.74,
        evidence: ['classic undefined property error'],
      });
    }

    if (/500|internal server/.test(blob) && !causes.length) {
      causes.push({
        rank: 0,
        cause: 'Unhandled exception in API layer',
        confidence: 0.55,
        evidence: ['HTTP 500 without more specific signature'],
      });
    }

    // Boost from previous incidents
    for (const inc of input.previousIncidents ?? []) {
      if (!inc.rootCause) continue;
      const sim = overlap(blob, `${inc.title} ${inc.rootCause}`.toLowerCase());
      if (sim >= 2) {
        causes.push({
          rank: 0,
          cause: `Recurrence of: ${inc.rootCause}`,
          confidence: Math.min(0.92, 0.55 + sim * 0.08),
          evidence: [`Prior incident ${inc.id}: ${inc.title}`],
        });
      }
    }

    for (const d of input.decisions ?? []) {
      if (/central|jwt|outbox|tenant/i.test(d) && /auth|payment|token/i.test(blob)) {
        causes.push({
          rank: 0,
          cause: `Possible drift from decision: ${d.slice(0, 80)}`,
          confidence: 0.48,
          evidence: ['architecture decision overlap'],
        });
      }
    }

    if (!causes.length) {
      causes.push({
        rank: 1,
        cause: 'Insufficient signal — gather stack, recent commits, and failing test output',
        confidence: 0.3,
        evidence: ['no strong pattern matched'],
      });
    }

    const sorted = causes
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    return {
      query: input.query,
      causes: sorted,
      relatedIncidentIds: (input.previousIncidents ?? [])
        .filter((i) => overlap(blob, `${i.title} ${i.description}`.toLowerCase()) >= 2)
        .map((i) => i.id)
        .slice(0, 10),
    };
  }
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  let n = 0;
  for (const t of b.split(/[^a-z0-9]+/)) if (ta.has(t)) n += 1;
  return n;
}

export function createRootCauseAnalyzer(): RootCauseAnalyzer {
  return new RootCauseAnalyzer();
}

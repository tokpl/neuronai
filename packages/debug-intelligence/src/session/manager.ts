import type { DebugSession, Incident } from '../types.js';
import { newId, nowIso } from '../types.js';
import { createRootCauseAnalyzer } from '../analysis/root-cause.js';
import { createRegressionAnalyzer } from '../diagnostics/regression.js';
import { createErrorPatternDatabase } from '../patterns/database.js';

/**
 * Debug session: collect context for Cursor — does not apply fixes.
 */
export class DebugSessionManager {
  private readonly sessions = new Map<string, DebugSession>();
  private readonly rca = createRootCauseAnalyzer();
  private readonly regression = createRegressionAnalyzer();
  private readonly patterns = createErrorPatternDatabase();

  start(input: {
    query: string;
    errorMessage?: string;
    stackTrace?: string;
    changedFiles?: string[];
    relatedMemories?: string[];
    incidents: Incident[];
    decisions?: string[];
  }): DebugSession {
    const related = this.regression
      .findSimilar(input.query + ' ' + (input.errorMessage ?? ''), input.incidents)
      .map((m) => input.incidents.find((i) => i.id === m.priorIncidentId))
      .filter(Boolean) as Incident[];

    const also = input.incidents.filter((i) =>
      related.every((r) => r.id !== i.id)
        ? overlap(input.query, `${i.title} ${i.description}`) >= 1
        : false,
    );

    const relatedIncidents = [...related, ...also].slice(0, 10);
    const rca = this.rca.analyze({
      query: input.query,
      errorMessage: input.errorMessage,
      stackTrace: input.stackTrace,
      changedFiles: input.changedFiles,
      previousIncidents: input.incidents,
      decisions: input.decisions,
    });

    const patternHits = this.patterns.match(
      `${input.errorMessage ?? ''} ${input.stackTrace ?? ''} ${input.query}`,
    );
    const riskFactors = [
      ...relatedIncidents.map((i) => `Prior: ${i.title}`),
      ...patternHits.map((p) => `Pattern: ${p.errorType}`),
      ...(input.changedFiles ?? []).slice(0, 5).map((f) => `Changed: ${f}`),
    ];

    const session: DebugSession = {
      id: newId('dbg'),
      query: input.query,
      errorMessage: input.errorMessage,
      stackTrace: input.stackTrace,
      changedFiles: input.changedFiles ?? [],
      relatedMemories: input.relatedMemories ?? [],
      relatedIncidents,
      possibleCauses: rca.causes,
      regressions: this.regression.findSimilar(
        input.query + ' ' + (input.errorMessage ?? ''),
        input.incidents,
      ),
      riskFactors,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): DebugSession | undefined {
    return this.sessions.get(id);
  }

  close(id: string): void {
    const s = this.sessions.get(id);
    if (s) {
      s.status = 'closed';
      s.updatedAt = nowIso();
    }
  }
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  let n = 0;
  for (const t of b.toLowerCase().split(/[^a-z0-9]+/)) if (ta.has(t)) n += 1;
  return n;
}

export function createDebugSessionManager(): DebugSessionManager {
  return new DebugSessionManager();
}

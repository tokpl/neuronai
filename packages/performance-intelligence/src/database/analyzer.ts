import type { PerformanceFinding } from '../types.js';
import { newId } from '../types.js';

/**
 * Database performance advisor — ORM/query heuristics, not EXPLAIN ANALYZE.
 */
export class DatabasePerformanceAnalyzer {
  analyze(input: {
    snippets?: string[];
    migrations?: string[];
    schemaNotes?: string[];
  }): PerformanceFinding[] {
    const blob = [
      ...(input.snippets ?? []),
      ...(input.migrations ?? []),
      ...(input.schemaNotes ?? []),
    ].join('\n');
    const findings: PerformanceFinding[] = [];

    if (
      /include\s*:\s*\{/i.test(blob) === false &&
      /(findmany|findall|users\.find)[\s\S]{0,200}(for\s*\(|\.map\s*\()/i.test(blob)
    ) {
      findings.push({
        id: newId('pf'),
        type: 'DATABASE',
        title: 'N+1 / relation load risk',
        detail: 'User list (or similar) appears to load relations individually.',
        severity: 'HIGH',
        confidence: 0.84,
        recommendation: 'Use eager loading (include/join) or batch loaders.',
        evidence: ['list query without include + iteration signals'],
      });
    }

    if (
      /findmany\([^)]*\)[\s\S]{0,80}(posts|orders|comments|items)/i.test(blob) &&
      !/include\s*:/i.test(blob)
    ) {
      findings.push({
        id: newId('pf'),
        type: 'DATABASE',
        title: 'Relations loaded lazily in aggregate path',
        detail: 'Detected collection access that often triggers per-row relation queries.',
        severity: 'HIGH',
        confidence: 0.8,
        recommendation: 'Use eager loading.',
        evidence: ['collection + missing include'],
      });
    }

    if (/createindex|@@index|addindex/i.test(blob)) {
      // positive signal — skip
    } else if (/where\s*:\s*\{[^}]*(email|slug|tenantid|userid)/i.test(blob)) {
      findings.push({
        id: newId('pf'),
        type: 'DATABASE',
        title: 'Possible missing index',
        detail: 'Filtered fields without nearby index declarations in provided signals.',
        severity: 'MEDIUM',
        confidence: 0.58,
        recommendation: 'Confirm indexes on hot filter columns (email, tenantId, etc.).',
        evidence: ['where filters, no index keyword'],
      });
    }

    if (/join[\s\S]{0,40}join[\s\S]{0,40}join/i.test(blob) || /include\s*:\s*\{[\s\S]{200,}/i.test(blob)) {
      findings.push({
        id: newId('pf'),
        type: 'DATABASE',
        title: 'Large join / deep include',
        detail: 'Deep joins or large include trees can amplify query cost.',
        severity: 'MEDIUM',
        confidence: 0.62,
        recommendation: 'Narrow selects; paginate; split read models if needed.',
        evidence: ['multi-join / large include'],
      });
    }

    if (/select\s+\*|findall\(\s*\)/i.test(blob)) {
      findings.push({
        id: newId('pf'),
        type: 'DATABASE',
        title: 'Wide select',
        detail: 'Selecting all columns increases IO and payload size.',
        severity: 'LOW',
        confidence: 0.55,
        recommendation: 'Project only required fields.',
        evidence: ['SELECT * / findAll()'],
      });
    }

    return findings;
  }
}

export function createDatabasePerformanceAnalyzer(): DatabasePerformanceAnalyzer {
  return new DatabasePerformanceAnalyzer();
}

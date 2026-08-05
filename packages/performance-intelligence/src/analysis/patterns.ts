import type { PerformanceFinding } from '../types.js';
import { newId } from '../types.js';

/**
 * Heuristic performance pattern detector — advisor, not a profiler.
 */
export class PerformancePatternAnalyzer {
  analyze(input: { snippets?: string[]; filePaths?: string[] }): PerformanceFinding[] {
    const blob = [...(input.snippets ?? []), ...(input.filePaths ?? [])].join('\n');
    const lower = blob.toLowerCase();
    const findings: PerformanceFinding[] = [];

    if (
      /for\s*\(.*of.*\)[\s\S]{0,120}(findunique|findone|await\s+\w+\.find)/i.test(blob) ||
      /n\+1|one.?by.?one|for\s*each.*await.*find/i.test(lower)
    ) {
      findings.push(
        finding(
          'DATABASE',
          'Repeated database queries in loop',
          'Possible N+1 / query-per-item pattern',
          'HIGH',
          0.82,
          'Batch queries or use eager loading / include',
          ['loop + per-item find'],
        ),
      );
    }

    if (/while\s*\(.*\)[\s\S]{0,80}(fsync|readfilesync|execsync|sleep\()/i.test(blob)) {
      findings.push(
        finding(
          'BACKEND',
          'Blocking operation in hot path',
          'Synchronous / blocking calls may stall the event loop',
          'HIGH',
          0.78,
          'Prefer async non-blocking APIs',
          ['sync/blocking call'],
        ),
      );
    }

    if (
      !/cache|redis|memo|lru/i.test(lower) &&
      /(findall|select\s+\*|heavy|aggregate)/i.test(lower)
    ) {
      findings.push(
        finding(
          'BACKEND',
          'Missing caching signal',
          'Expensive reads without an obvious cache layer',
          'MEDIUM',
          0.55,
          'Consider caching for hot read paths',
          ['expensive read, no cache keywords'],
        ),
      );
    }

    if (/for\s*\(\s*let\s+\w+\s*=\s*0[\s\S]{0,200}for\s*\(\s*let/i.test(blob)) {
      findings.push(
        finding(
          'BACKEND',
          'Nested loops',
          'Nested iteration can become O(n²) under load',
          'MEDIUM',
          0.6,
          'Index lookups, maps, or pre-aggregation',
          ['nested for loops'],
        ),
      );
    }

    if (/usestate|useeffect|component[\s\S]{0,40}\{[\s\S]{3000,}/i.test(blob)) {
      findings.push(
        finding(
          'FRONTEND',
          'Large component body',
          'Very large component / hook surface may hurt maintainability and renders',
          'MEDIUM',
          0.58,
          'Split components; memoize expensive children',
          ['large component heuristic'],
        ),
      );
    }

    if (
      /setstate|usestate/i.test(lower) &&
      !/memo|usecallback|usememo|react\.memo/i.test(lower) &&
      /map\s*\(\s*\(/i.test(lower)
    ) {
      findings.push(
        finding(
          'FRONTEND',
          'Possible unnecessary renders',
          'List rendering with state and no memoization signals',
          'MEDIUM',
          0.52,
          'Review React.memo / useMemo / stable callbacks',
          ['list + state, weak memo signals'],
        ),
      );
    }

    return findings;
  }
}

function finding(
  type: PerformanceFinding['type'],
  title: string,
  detail: string,
  severity: PerformanceFinding['severity'],
  confidence: number,
  recommendation: string,
  evidence: string[],
): PerformanceFinding {
  return {
    id: newId('pf'),
    type,
    title,
    detail,
    severity,
    confidence,
    recommendation,
    evidence,
  };
}

export function createPerformancePatternAnalyzer(): PerformancePatternAnalyzer {
  return new PerformancePatternAnalyzer();
}

import type { ArchitectureBoundary, BoundaryFinding, ModuleNode } from '../types.js';

const MIXED_HINTS = [
  'database',
  'ai provider',
  'ai-provider',
  'http',
  'ui',
  'auth',
  'storage',
  'network',
];

/**
 * Checks whether modules have clear responsibilities.
 */
export class BoundaryAnalyzer {
  analyze(
    modules: ModuleNode[],
    boundaries: ArchitectureBoundary[] = [],
  ): BoundaryFinding[] {
    const findings: BoundaryFinding[] = [];

    for (const m of modules) {
      const observed = m.responsibilities ?? [];
      const boundary = boundaries.find((b) => b.moduleId === m.id);
      const expected = boundary?.expectedResponsibilities ?? [];

      if (observed.length >= 3) {
        const mixed = observed.filter((r) =>
          MIXED_HINTS.some((h) => r.toLowerCase().includes(h)),
        );
        if (mixed.length >= 2) {
          findings.push({
            moduleId: m.id,
            issue: `${m.name} mixes concerns: ${mixed.join(', ')}`,
            recommendation: 'Split responsibilities into focused modules (e.g. storage vs AI).',
          });
        }
      }

      if (expected.length && observed.length) {
        const unexpected = observed.filter(
          (o) => !expected.some((e) => e.toLowerCase() === o.toLowerCase()),
        );
        if (unexpected.length) {
          findings.push({
            moduleId: m.id,
            issue: `${m.name} has unexpected responsibilities: ${unexpected.join(', ')}`,
            recommendation: `Keep ${m.name} limited to: ${expected.join(', ')}.`,
          });
        }
      }

      // Classic example: Memory module with database + AI provider
      const blob = `${m.name} ${(m.responsibilities ?? []).join(' ')}`.toLowerCase();
      if (
        /memory/.test(blob) &&
        /(database|db|sql)/.test(blob) &&
        /(ai provider|openai|llm)/.test(blob)
      ) {
        findings.push({
          moduleId: m.id,
          issue: 'Memory module contains database logic and AI provider logic',
          recommendation: 'Split responsibilities — storage abstraction vs AI runtime.',
        });
      }
    }

    return dedupe(findings);
  }
}

function dedupe(findings: BoundaryFinding[]): BoundaryFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = `${f.moduleId}:${f.issue}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function createBoundaryAnalyzer(): BoundaryAnalyzer {
  return new BoundaryAnalyzer();
}

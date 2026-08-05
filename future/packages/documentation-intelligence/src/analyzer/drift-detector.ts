import type { DocFact, DriftFinding } from '../types.js';
import { newId } from '../types.js';

/**
 * Detect documentation vs actual project brain mismatches.
 */
export class DocumentationDriftDetector {
  detect(docFacts: DocFact[], brainFacts: DocFact[]): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const keys = new Set([
      ...docFacts.map((f) => f.key),
      ...brainFacts.filter((f) => f.key === 'database' || f.key === 'framework').map((f) => f.key),
    ]);

    for (const key of keys) {
      if (key !== 'database' && key !== 'framework' && key !== 'language') continue;
      const docs = uniqueValues(docFacts.filter((f) => f.key === key));
      const brain = uniqueValues(brainFacts.filter((f) => f.key === key));
      if (!docs.length || !brain.length) continue;

      for (const documented of docs) {
        if (brain.some((b) => normalize(b) === normalize(documented))) continue;
        // If brain has a clearly different primary value
        const actual = brain[0]!;
        if (normalize(actual) === normalize(documented)) continue;
        if (brain.some((b) => normalize(b).includes(normalize(documented)))) continue;

        findings.push({
          id: newId('drift'),
          topic: key,
          documented,
          actual: brain.join(', '),
          recommendation: `Update documentation: ${key} is documented as "${documented}" but project brain shows "${brain.join(', ')}"`,
          severity: key === 'database' ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    // Modules documented but missing from brain
    const docMods = uniqueValues(docFacts.filter((f) => f.key === 'module'));
    const brainMods = uniqueValues(brainFacts.filter((f) => f.key === 'module')).map(normalize);
    for (const m of docMods) {
      if (brainMods.length && !brainMods.some((b) => b.includes(normalize(m)) || normalize(m).includes(b))) {
        // Only flag if brain has modules at all and this one is orphaned-looking
        if (brainMods.length >= 1 && normalize(m).length > 3) {
          findings.push({
            id: newId('drift'),
            topic: 'module',
            documented: m,
            actual: brainMods.join(', ') || '(none)',
            recommendation: `Verify module "${m}" still exists or update docs`,
            severity: 'LOW',
          });
        }
      }
    }

    return dedupe(findings);
  }
}

function uniqueValues(facts: DocFact[]): string[] {
  return [...new Set(facts.map((f) => f.value.trim()).filter(Boolean))];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function dedupe(findings: DriftFinding[]): DriftFinding[] {
  const seen = new Set<string>();
  const out: DriftFinding[] = [];
  for (const f of findings) {
    const k = `${f.topic}|${normalize(f.documented)}|${normalize(f.actual)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

export function createDocumentationDriftDetector(): DocumentationDriftDetector {
  return new DocumentationDriftDetector();
}

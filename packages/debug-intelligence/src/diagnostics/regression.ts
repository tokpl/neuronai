import type { Incident, RegressionMatch } from '../types.js';

/**
 * Detect similar historical incidents (regression-like recurrence).
 */
export class RegressionAnalyzer {
  findSimilar(current: string, history: Incident[], minSimilarity = 0.3): RegressionMatch[] {
    const curTokens = tokens(current);
    const matches: RegressionMatch[] = [];

    for (const inc of history) {
      const titleDesc = `${inc.title} ${inc.description}`;
      const full = `${titleDesc} ${inc.rootCause ?? ''} ${inc.errorSignature ?? ''}`;
      // Prefer title/description overlap so long root-cause text doesn't dilute the score.
      const sim = Math.max(
        jaccard(curTokens, tokens(titleDesc)),
        jaccard(curTokens, tokens(full)) * 0.85,
        containment(curTokens, tokens(inc.title)),
      );
      if (sim < minSimilarity) continue;
      matches.push({
        current,
        priorIncidentId: inc.id,
        priorTitle: inc.title,
        similarity: Math.round(sim * 1000) / 1000,
        message: `Similar incident detected: "${inc.title}" (${Math.round(sim * 100)}% overlap)`,
      });
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Share of current tokens present in a shorter title set. */
function containment(current: Set<string>, title: Set<string>): number {
  if (!current.size || !title.size) return 0;
  let inter = 0;
  for (const t of title) if (current.has(t)) inter += 1;
  return inter / title.size;
}

export function createRegressionAnalyzer(): RegressionAnalyzer {
  return new RegressionAnalyzer();
}

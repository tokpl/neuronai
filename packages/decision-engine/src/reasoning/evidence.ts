import type { EvidenceItem, ReasoningContext } from '../types.js';

/**
 * Gather structured evidence from provided project context (no hidden LLM black box).
 */
export class EvidenceGatherer {
  gather(ctx: ReasoningContext): EvidenceItem[] {
    const items: EvidenceItem[] = [];

    for (const m of ctx.memories ?? []) {
      items.push({
        kind: 'memory',
        ref: truncate(m, 80),
        detail: m,
        weight: 0.7,
      });
    }
    for (const d of ctx.decisions ?? []) {
      items.push({
        kind: 'decision',
        ref: truncate(d, 80),
        detail: d,
        weight: 0.85,
      });
    }
    for (const i of ctx.incidents ?? []) {
      items.push({
        kind: 'incident',
        ref: truncate(i, 80),
        detail: i,
        weight: 0.8,
      });
    }
    for (const r of ctx.rules ?? []) {
      items.push({
        kind: 'rule',
        ref: truncate(r, 80),
        detail: r,
        weight: 0.9,
      });
    }
    for (const c of ctx.codeRefs ?? []) {
      items.push({
        kind: 'code',
        ref: c,
        detail: `Code reference: ${c}`,
        weight: 0.65,
      });
    }
    for (const p of ctx.patterns ?? []) {
      items.push({
        kind: 'pattern',
        ref: truncate(p, 80),
        detail: p,
        weight: 0.75,
      });
    }
    if (ctx.graphSummary) {
      items.push({
        kind: 'graph',
        ref: 'knowledge-graph',
        detail: ctx.graphSummary,
        weight: 0.7,
      });
    }

    return items.slice(0, 40);
  }
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export function createEvidenceGatherer(): EvidenceGatherer {
  return new EvidenceGatherer();
}

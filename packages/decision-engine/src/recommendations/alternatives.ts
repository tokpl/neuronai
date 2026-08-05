import type { OptionPair, ReasoningContext } from '../types.js';
import { createEvidenceGatherer } from '../reasoning/evidence.js';
import { createReasoningEngine } from '../reasoning/engine.js';

/**
 * Compare Option A vs B with tradeoffs — recommendation is advisory.
 */
export class AlternativeAnalyzer {
  private readonly reasoner = createReasoningEngine();
  private readonly evidence = createEvidenceGatherer();

  compare(pair: OptionPair, ctx: Omit<ReasoningContext, 'request'> & { request?: string }) {
    const topic = pair.topic ?? 'choice';
    const request =
      ctx.request ??
      `Compare ${pair.a.name} vs ${pair.b.name} for ${topic}`;

    const enriched: ReasoningContext = {
      ...ctx,
      request,
      patterns: [
        ...(ctx.patterns ?? []),
        `Option A: ${pair.a.name}${pair.a.notes ? ` — ${pair.a.notes}` : ''}`,
        `Option B: ${pair.b.name}${pair.b.notes ? ` — ${pair.b.notes}` : ''}`,
      ],
    };

    // Prefer draft alternatives when present
    const draft = this.reasoner.reason(enriched);
    const evidence = this.evidence.gather(enriched);

    const aScore = scoreOption(pair.a.name, enriched);
    const bScore = scoreOption(pair.b.name, enriched);
    const recommend = aScore >= bScore ? pair.a.name : pair.b.name;

    return {
      topic,
      optionA: { name: pair.a.name, tradeoffs: pair.a.notes ?? 'See evidence', score: aScore },
      optionB: { name: pair.b.name, tradeoffs: pair.b.notes ?? 'See evidence', score: bScore },
      recommendation: recommend,
      reasoning: [
        `Based on project patterns: ${recommend} recommended.`,
        ...draft.reasoning.slice(0, 3),
      ],
      evidence,
      draft,
    };
  }
}

function scoreOption(name: string, ctx: ReasoningContext): number {
  const blob = [
    ...(ctx.decisions ?? []),
    ...(ctx.patterns ?? []),
    ...(ctx.memories ?? []),
    ...(ctx.codeRefs ?? []),
  ]
    .join('\n')
    .toLowerCase();
  const key = name.toLowerCase();
  let score = 0.4;
  if (blob.includes(key)) score += 0.35;
  // common aliases
  if (key.includes('postgres') && /postgres|sql|prisma/.test(blob)) score += 0.2;
  if (key.includes('mongo') && /mongo/.test(blob)) score += 0.2;
  return Math.min(0.95, score);
}

export function createAlternativeAnalyzer(): AlternativeAnalyzer {
  return new AlternativeAnalyzer();
}

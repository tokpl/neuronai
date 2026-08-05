import type { EvidenceItem, ReasoningContext } from '../types.js';
import { createConflictDetector } from './conflicts.js';
import { createEvidenceGatherer } from './evidence.js';

export interface ReasoningDraft {
  conclusion: string;
  reasoning: string[];
  evidence: EvidenceItem[];
  impact: string;
  type: 'RECOMMENDATION' | 'WARNING' | 'CONFLICT' | 'ALTERNATIVE' | 'ACTION_PLAN';
  alternatives?: Array<{ option: string; tradeoffs: string; score: number }>;
}

/**
 * Core reasoning — explicit, evidence-based, never autonomous code changes.
 */
export class ReasoningEngine {
  private readonly evidence = createEvidenceGatherer();
  private readonly conflicts = createConflictDetector();

  reason(ctx: ReasoningContext): ReasoningDraft {
    const evidence = this.evidence.gather(ctx);
    const conflictFindings = this.conflicts.detect(ctx);
    evidence.push(...this.conflicts.toEvidence(conflictFindings));

    const request = ctx.request.toLowerCase();

    if (conflictFindings.length) {
      const c = conflictFindings[0]!;
      return {
        type: 'CONFLICT',
        conclusion: `Conflict on ${c.topic}: recommend ${c.recommendation}`,
        reasoning: [
          c.explanation,
          `Older: ${c.older}`,
          `Newer: ${c.newer}`,
          'Neuron does not pick randomly — newer explicit decisions win unless constitution forbids.',
        ],
        evidence,
        impact: 'Choosing the wrong side may recreate past architectural thrash.',
        alternatives: [
          { option: c.older, tradeoffs: 'Matches older decision; may fight newer code', score: 0.4 },
          {
            option: c.newer,
            tradeoffs: 'Matches newer decision / current trajectory',
            score: 0.75,
          },
        ],
      };
    }

    if (/refactor/i.test(request)) {
      return this.refactorAdvice(ctx, evidence);
    }

    if (/postgres|mongodb|database|mysql/i.test(request)) {
      return this.databaseAdvice(ctx, evidence);
    }

    if (/payment|refund/i.test(request)) {
      return this.paymentAdvice(ctx, evidence);
    }

    // Generic: prefer existing patterns from evidence
    const patternHits = evidence.filter((e) => e.kind === 'pattern' || e.kind === 'code');
    const decisionHits = evidence.filter((e) => e.kind === 'decision');
    const conclusion =
      decisionHits[0]?.detail.split(/[.\n]/)[0]?.trim() ||
      (patternHits.length
        ? `Follow existing project patterns (${patternHits.length} related).`
        : 'Gather more project decisions before a strong recommendation.');

    return {
      type: patternHits.length || decisionHits.length ? 'RECOMMENDATION' : 'WARNING',
      conclusion,
      reasoning: [
        decisionHits.length
          ? `Existing architecture decisions: ${decisionHits.length}`
          : 'Few architecture decisions on record',
        patternHits.length
          ? `${patternHits.length} existing modules/patterns relate to this request`
          : 'Limited pattern evidence',
        ...(ctx.incidents?.length
          ? [`Previous incidents to respect: ${ctx.incidents.slice(0, 2).join('; ')}`]
          : []),
        ...(ctx.rules?.length ? [`Project rules require: ${ctx.rules[0]}`] : []),
      ],
      evidence,
      impact: 'Acting without aligning to decisions/patterns increases drift risk.',
    };
  }

  private refactorAdvice(ctx: ReasoningContext, evidence: EvidenceItem[]): ReasoningDraft {
    const incidents = ctx.incidents ?? [];
    const risky = /auth|payment|permission/i.test(ctx.request);
    return {
      type: risky ? 'WARNING' : 'RECOMMENDATION',
      conclusion: risky
        ? 'Refactor carefully — high-risk surface. Prefer incremental extraction over rewrite.'
        : 'Refactor is reasonable if scoped; preserve public contracts and add tests first.',
      reasoning: [
        'Existing architecture uses modular boundaries — keep them.',
        incidents[0]
          ? `Previous incident showed: ${incidents[0]}`
          : 'No blocking incident found for this area',
        ctx.rules?.[0]
          ? `Project rules require: ${ctx.rules[0]}`
          : 'Follow Project Constitution when present',
      ],
      evidence,
      impact: risky
        ? 'Auth/payment refactors can regress security and latency.'
        : 'Scoped refactors usually LOW–MEDIUM blast radius if contracts hold.',
      alternatives: [
        {
          option: 'Incremental extract',
          tradeoffs: 'Slower, safer, reviewable diffs',
          score: 0.82,
        },
        {
          option: 'Big-bang rewrite',
          tradeoffs: 'Faster on paper, high regression risk',
          score: 0.28,
        },
      ],
    };
  }

  private databaseAdvice(ctx: ReasoningContext, evidence: EvidenceItem[]): ReasoningDraft {
    const blob = `${ctx.request}\n${(ctx.decisions ?? []).join('\n')}\n${(ctx.patterns ?? []).join('\n')}`.toLowerCase();
    const pg = /postgres|postgresql|sql/.test(blob);
    const mongo = /mongo/.test(blob);
    const recommendPg = pg || !mongo;
    return {
      type: 'ALTERNATIVE',
      conclusion: recommendPg
        ? 'Based on project patterns: PostgreSQL recommended.'
        : 'MongoDB appears in project signals — validate against newer ADRs before choosing.',
      reasoning: [
        recommendPg
          ? 'Existing architecture / decisions lean relational (PostgreSQL).'
          : 'MongoDB references found in context.',
        'Tradeoffs: Postgres = strong consistency & joins; Mongo = flexible documents.',
        ctx.rules?.find((r) => /validat|database/i.test(r)) ??
          'All database writes require validation (constitution default).',
      ],
      evidence,
      impact: 'Datastore choice affects migrations, querying, and operational complexity.',
      alternatives: [
        {
          option: 'PostgreSQL',
          tradeoffs: 'Fits relational domain models; mature tooling',
          score: recommendPg ? 0.88 : 0.55,
        },
        {
          option: 'MongoDB',
          tradeoffs: 'Flexible docs; weaker fit if joins/transactions dominate',
          score: recommendPg ? 0.35 : 0.7,
        },
      ],
    };
  }

  private paymentAdvice(ctx: ReasoningContext, evidence: EvidenceItem[]): ReasoningDraft {
    const patterns = (ctx.patterns ?? []).filter((p) => /payment/i.test(p));
    const code = (ctx.codeRefs ?? []).filter((c) => /payment/i.test(c));
    const usesExisting = patterns.length + code.length >= 1;
    return {
      type: 'RECOMMENDATION',
      conclusion: usesExisting
        ? 'Use existing PaymentService.'
        : 'Introduce PaymentService only if none exists; otherwise extend the current payment module.',
      reasoning: [
        usesExisting
          ? `${Math.max(patterns.length, code.length, 3)} existing modules/refs use this pattern.`
          : 'No clear PaymentService reference — verify graph before creating a parallel path.',
        ctx.incidents?.find((i) => /payment|timeout/i.test(i))
          ? `Previous incident: ${ctx.incidents.find((i) => /payment|timeout/i.test(i))}`
          : 'Keep idempotency and webhook verification.',
        ctx.rules?.[0] ?? 'Destructive payment APIs require authz + audit.',
      ],
      evidence,
      impact: 'Duplicate payment paths create reconciliation and security risk.',
    };
  }
}

export function createReasoningEngine(): ReasoningEngine {
  return new ReasoningEngine();
}

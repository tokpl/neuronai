import { describe, expect, it } from 'vitest';

import {
  createBrainCompiler,
  estimateTokens,
  prepareContext,
  PREPARATION_TOKEN_BUDGETS,
  type RetrievalDoc,
  type RetrievalHit,
} from '../src/index.js';

function hit(
  id: string,
  kind: RetrievalHit['doc']['kind'],
  title: string,
  content: string,
  score = 0.7,
): RetrievalHit {
  return {
    doc: { id, kind, title, content },
    score,
    relevance: score,
    coverage: 1,
    matchedTerms: ['x'],
    why: 'matched x',
  };
}

const longText = (label: string) =>
  `${label} ${'detail about the implementation and its consequences. '.repeat(12)}`;

describe('BrainCompiler', () => {
  it('produces exactly one representation of the context', () => {
    const compiled = createBrainCompiler().compile({
      task: 'Add rate limiting',
      hits: [hit('d1', 'decision', 'Rate limiting in middleware', 'Apply it once in middleware.')],
    });

    // The canonical field is `context`. No briefing/markdown/prompt twins.
    expect(compiled.context).toContain('Rate limiting in middleware');
    expect(Object.keys(compiled)).toEqual(['context', 'mode', 'metrics', 'sources']);
  });

  it('never repeats the same memory in the compiled context', () => {
    const compiled = createBrainCompiler().compile({
      task: 'Add rate limiting',
      mode: 'deep',
      hits: [
        hit('d1', 'decision', 'Rate limiting in middleware', 'Apply it once in middleware.'),
        hit('d2', 'decision', 'Rate limiting in middleware', 'Apply it once in middleware.'),
        hit('d3', 'decision', 'Rate limiting in middleware', 'Apply it once in  middleware!'),
      ],
    });

    const occurrences = compiled.context.split('Rate limiting in middleware').length - 1;
    expect(occurrences).toBe(1);
    expect(compiled.metrics.duplicatesRemoved).toBe(2);
  });

  it('keeps internal metadata out of the compiled context', () => {
    const compiled = createBrainCompiler().compile({
      task: 'Refactor persistence',
      mode: 'deep',
      hits: [
        hit(
          'd1',
          'decision',
          'ProjectBrain owns persistence',
          'Decision: importanceScore and rankingScore must never leak. Persistence stays in ProjectBrain.',
        ),
      ],
    });

    expect(compiled.context).not.toMatch(/importanceScore|rankingScore|taskRelevance|rawDump/);
    expect(compiled.context).not.toContain('d1');
    expect(compiled.context).not.toMatch(/score/i);
  });

  it('defaults to minimal mode', () => {
    const compiled = createBrainCompiler().compile({ task: 'anything', hits: [] });
    expect(compiled.mode).toBe('minimal');
    expect(compiled.metrics.tokenBudget).toBe(500);
  });

  it.each([
    ['minimal', 500],
    ['standard', 1200],
    ['deep', 3500],
  ] as const)('respects the %s token budget', (mode, budget) => {
    const hits = Array.from({ length: 40 }, (_, i) =>
      hit(`d${i}`, i % 2 ? 'decision' : 'pattern', `Memory ${i}`, longText(`Memory ${i}`)),
    );

    const compiled = createBrainCompiler().compile({ task: 'big task', mode, hits });

    expect(PREPARATION_TOKEN_BUDGETS[mode]).toBe(budget);
    expect(compiled.metrics.compiledTokens).toBeLessThanOrEqual(budget);
    expect(estimateTokens(compiled.context)).toBeLessThanOrEqual(budget);
  });

  it('keeps warnings and decisions when the budget forces patterns out', () => {
    const hits = [
      // Ten patterns that all outrank the warning and the decision on score alone.
      ...Array.from({ length: 10 }, (_, i) =>
        hit(`p${i}`, 'pattern', `Pattern ${i}`, longText(`Pattern ${i}`), 0.9),
      ),
      hit('w1', 'warning', 'Never bypass the permission service', longText('warning'), 0.4),
      hit('d1', 'decision', 'Use RBAC with hierarchy', longText('decision'), 0.4),
    ];

    const compiled = createBrainCompiler().compile({ task: 'permissions', mode: 'minimal', hits });

    expect(compiled.context).toContain('Never bypass the permission service');
    expect(compiled.context).toContain('Use RBAC with hierarchy');
    // Patterns are the first thing sacrificed to the budget, not the last.
    const patternsKept = Array.from({ length: 10 }, (_, i) => `Pattern ${i}`).filter((t) =>
      compiled.context.includes(t),
    );
    expect(patternsKept.length).toBeLessThanOrEqual(1);
    expect(compiled.metrics.compiledTokens).toBeLessThanOrEqual(500);
  });

  it('still surfaces a relevant pattern in minimal mode when nothing outranks it', () => {
    const compiled = createBrainCompiler().compile({
      task: 'how does authentication work',
      mode: 'minimal',
      hits: [
        hit('p1', 'pattern', 'Authentication uses JWT middleware', 'Auth runs as middleware.'),
      ],
    });

    expect(compiled.context).toContain('Authentication uses JWT middleware');
    expect(compiled.metrics.selected).toBe(1);
  });

  it('reports honest compression metrics', () => {
    const hits = Array.from({ length: 12 }, (_, i) =>
      hit(`d${i}`, 'decision', `Decision ${i}`, longText(`Decision ${i}`)),
    );
    const compiled = createBrainCompiler().compile({
      task: 'task',
      mode: 'minimal',
      hits,
      retrieval: { candidates: 100, matched: 12, durationMs: 3 },
    });

    expect(compiled.metrics.candidates).toBe(100);
    expect(compiled.metrics.relevant).toBe(12);
    expect(compiled.metrics.selected).toBeLessThan(12);
    expect(compiled.metrics.discarded).toBe(100 - compiled.metrics.selected);
    expect(compiled.metrics.compressionRatio).toBeGreaterThan(1);
    expect(compiled.metrics.retrievalMs).toBe(3);
    expect(compiled.sources).toHaveLength(compiled.metrics.selected);
  });

  it('says so plainly when nothing matched', () => {
    const compiled = createBrainCompiler().compile({ task: 'unknown area', hits: [] });
    expect(compiled.context).toContain('No stored project knowledge matched this task');
    expect(compiled.metrics.selected).toBe(0);
  });
});

describe('prepareContext', () => {
  const docs: RetrievalDoc[] = [
    {
      id: 'd1',
      title: 'Rate limiting belongs in MCP middleware',
      content: 'Apply rate limiting once in the MCP server middleware, not per handler.',
      kind: 'decision',
      importance: 0.6,
      freshness: 0.5,
      confidence: 0.8,
    },
    {
      id: 'd2',
      title: 'AGPL-3.0 licensing for first-party NeuronAI',
      content: 'The project ships under AGPL-3.0 with a separate trademark policy.',
      kind: 'decision',
      importance: 1,
      freshness: 1,
      confidence: 1,
    },
  ];

  it('retrieves and compiles in one pass, excluding irrelevant knowledge', () => {
    const prepared = prepareContext({
      task: 'add rate limiting to the MCP server tool handlers',
      docs,
    });

    expect(prepared.context).toContain('Rate limiting');
    expect(prepared.context).not.toContain('AGPL');
    expect(prepared.hits[0]?.doc.id).toBe('d1');
    expect(prepared.metrics.candidates).toBe(2);
    expect(prepared.metrics.compiledTokens).toBeLessThanOrEqual(500);
    expect(prepared.efficiency.contextTokens).toBe(prepared.metrics.compiledTokens);
    expect(prepared.efficiency.budgetTokens).toBe(500);
    expect(prepared.efficiency.corpusTokens).toBeGreaterThan(prepared.efficiency.contextTokens);
    expect(prepared.efficiency.baseline).toBe('whole-brain-verbatim');
    expect(prepared.efficiency.estimatedTokensSaved).toBeGreaterThan(0);
    expect(prepared.intent).toBeTruthy();
  });

  it('recommends a concrete file when asked where to add something', () => {
    const docs: RetrievalDoc[] = [
      {
        id: 'm1',
        title: 'billing module — src/billing/',
        content: 'Billing / payments\nLocation: src/billing/',
        kind: 'location',
        tags: ['billing', 'module'],
        importance: 0.75,
        freshness: 0.9,
        confidence: 0.9,
        location: {
          kind: 'module',
          name: 'billing',
          path: 'src/billing/',
          purpose: 'Billing / payments',
          module: 'billing',
          concepts: ['billing'],
        },
      },
      {
        id: 'f1',
        title: 'service.ts — src/billing/service.ts',
        content: 'Service / business logic\nLocation: src/billing/service.ts billing payment',
        kind: 'location',
        tags: ['billing', 'file'],
        importance: 0.6,
        freshness: 0.9,
        confidence: 0.9,
        location: {
          kind: 'file',
          name: 'service.ts',
          path: 'src/billing/service.ts',
          purpose: 'Service / business logic',
          module: 'billing',
          concepts: ['billing'],
        },
      },
      {
        id: 'r1',
        title: 'Routes must not call payment providers directly',
        content: 'Payment providers must be called from services, never from route handlers.',
        kind: 'rule',
        tags: ['billing', 'payment'],
        importance: 0.85,
        freshness: 0.9,
        confidence: 0.9,
      },
    ];

    const prepared = prepareContext({
      task: 'Where should I add a payment endpoint?',
      docs,
    });

    expect(prepared.intent).toBe('MODIFICATION');
    expect(prepared.recommendation?.path).toMatch(/billing/);
    expect(prepared.context).toMatch(/Recommended start/i);
    expect(prepared.context).toMatch(/src\/billing/);
    expect(prepared.context).toMatch(/## Rules/i);
    expect(prepared.context).toMatch(/Payment providers must be called from services/i);
    expect(prepared.efficiency.contextTokens).toBeLessThanOrEqual(500);
  });

  it('keeps matching rules when many location hits compete for the budget', () => {
    const docs: RetrievalDoc[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `loc-${i}`,
        title: `PaymentSymbol${i} — src/services/payment-${i}.ts`,
        content: `Payment service helper ${i}\nLocation: src/services/payment-${i}.ts`,
        kind: 'location' as const,
        location: {
          kind: 'symbol' as const,
          name: `PaymentSymbol${i}`,
          path: `src/services/payment-${i}.ts`,
          purpose: 'Payment helper',
          concepts: ['billing', 'payment'],
        },
        importance: 0.7,
        freshness: 0.9,
        confidence: 0.9,
      })),
      {
        id: 'rule-stripe',
        title: 'Never call Stripe directly from route handlers',
        content: 'Never call Stripe directly from route handlers. Always go through PaymentService.',
        kind: 'rule',
        tags: ['billing', 'stripe', 'payment'],
        importance: 0.9,
        freshness: 1,
        confidence: 0.9,
      },
    ];

    const prepared = prepareContext({
      task: 'Add support for invoice cancellation.',
      docs,
    });

    expect(prepared.context).toMatch(/## Rules/i);
    expect(prepared.relevantRules.some((r) => /Stripe/i.test(r.title))).toBe(true);
  });
});

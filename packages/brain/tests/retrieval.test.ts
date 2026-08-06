import { describe, expect, it } from 'vitest';

import { retrieve, type RetrievalDoc } from '../src/retrieval/index.js';

/**
 * Corpus modelled on the real NeuronAI brain, including the memories that the
 * principal-engineering audit observed being returned for unrelated tasks.
 */
const corpus: RetrievalDoc[] = [
  {
    id: 'd1',
    title: 'ProjectBrain is the single runtime source of truth',
    content:
      'All runtime components (CLI, MCP, Scan, Search, Doctor, Cursor integration) must communicate through the ProjectBrain API. .neuron/brain/ is the canonical persistent representation.',
    kind: 'decision',
    type: 'architecture_decision',
    importance: 1,
    freshness: 1,
    confidence: 1,
  },
  {
    id: 'd2',
    title: 'AGPL-3.0 for first-party NeuronAI (docs/metadata)',
    content:
      'Problem: need open-source distribution with protection against closed SaaS freeriding. Decision: first-party NeuronAI is AGPL-3.0. Brand remains under TRADEMARK.md.',
    kind: 'decision',
    type: 'architecture_decision',
    importance: 1,
    freshness: 1,
    confidence: 0.7,
  },
  {
    id: 'd3',
    title: 'Ask-before-remember UX: autoSave true with Yes/No consent',
    content:
      'Problem: Save|Edit|Ignore felt like fake buttons. Decision: default memory autoSave true, privacy mode stays suggest so the user confirms before writing memory.',
    kind: 'decision',
    type: 'architecture_decision',
    importance: 0.75,
    freshness: 1,
    confidence: 0.75,
  },
  {
    id: 'd4',
    title: 'Rate limiting belongs in MCP middleware, not individual handlers',
    content:
      'Decision: apply rate limiting once in the MCP server middleware layer so every tool handler inherits it. Avoid per-handler throttling.',
    kind: 'decision',
    type: 'architecture_decision',
    importance: 0.6,
    freshness: 0.5,
    confidence: 0.8,
  },
  {
    id: 'p1',
    title: 'Authentication uses a JWT middleware',
    content:
      'Auth is handled by JWT middleware in the request pipeline. Never add ad-hoc session checks inside route handlers.',
    kind: 'pattern',
    type: 'pattern',
    importance: 0.5,
    freshness: 0.4,
    confidence: 0.9,
  },
  {
    id: 'w1',
    title: 'Do not bypass the permission service',
    content: 'Bypassing the permission service caused authentication bugs in the past.',
    kind: 'warning',
    type: 'mistake',
    importance: 0.7,
    freshness: 0.6,
    confidence: 0.9,
  },
  {
    id: 'k1',
    title: 'MCP server tools are registered in register-tools.ts',
    content:
      'The MCP server registers every tool handler in tools/register-tools.ts and dispatches to handlers/.',
    kind: 'knowledge',
    type: 'knowledge',
    importance: 0.4,
    freshness: 0.5,
    confidence: 0.8,
  },
  {
    id: 'k2',
    title: 'README installation uses npm install -g neuronai',
    content: 'Installation instructions live in the README and use npm install -g neuronai.',
    kind: 'knowledge',
    type: 'knowledge',
    importance: 0.3,
    freshness: 0.5,
    confidence: 0.8,
  },
  {
    id: 'k3',
    title: 'ProjectBrain persistence writes .neuron/brain JSON planes',
    content:
      'ProjectBrain.save() persists dna, knowledge, health, goals and active planes as JSON under .neuron/brain/.',
    kind: 'knowledge',
    type: 'knowledge',
    importance: 0.5,
    freshness: 0.5,
    confidence: 0.8,
  },
];

const titlesFor = (query: string, limit = 5): string[] =>
  retrieve(query, corpus, { limit }).hits.map((h) => h.doc.title);

describe('retrieval relevance', () => {
  it('ranks the on-topic memory first for a multi-word task', () => {
    const hits = retrieve('add rate limiting to the MCP server tool handlers', corpus).hits;
    expect(hits[0]?.doc.id).toBe('d4');
  });

  it('does not let an irrelevant high-importance memory outrank a relevant one', () => {
    const hits = retrieve('add rate limiting to the MCP server tool handlers', corpus).hits;
    const ids = hits.map((h) => h.doc.id);
    // The licensing and consent decisions have importance 1.0 / freshness 1.0.
    expect(ids).not.toContain('d2');
    expect(ids).not.toContain('d3');
  });

  it('excludes memories that share no subject term with the query', () => {
    const hits = retrieve('how does authentication work', corpus).hits;
    for (const hit of hits) {
      expect(hit.matchedTerms.length).toBeGreaterThan(0);
    }
    expect(hits.map((h) => h.doc.id)).not.toContain('d2');
  });

  it('finds authentication knowledge across title and content', () => {
    const ids = retrieve('how does authentication work', corpus).hits.map((h) => h.doc.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('w1');
  });

  it('routes a consent-UX task to the consent decision', () => {
    expect(titlesFor('change the memory consent UX')[0]).toContain('Ask-before-remember');
  });

  it('routes a persistence refactor to persistence knowledge', () => {
    const ids = retrieve('refactor ProjectBrain persistence', corpus).hits.map((h) => h.doc.id);
    expect(ids.slice(0, 2)).toContain('k3');
    expect(ids).not.toContain('d2');
  });

  it('routes a README task to the README memory', () => {
    expect(titlesFor('update the README installation instructions')[0]).toContain('README');
  });

  it('scores multi-term matches above single-term matches', () => {
    const result = retrieve('MCP server tool handlers', corpus);
    const d4 = result.hits.find((h) => h.doc.id === 'd4');
    const k1 = result.hits.find((h) => h.doc.id === 'k1');
    expect(d4).toBeDefined();
    expect(k1).toBeDefined();
    expect(d4!.coverage).toBeGreaterThanOrEqual(k1!.coverage);
  });

  it('rewards an exact phrase match', () => {
    const withPhrase = retrieve('rate limiting', corpus).hits[0];
    expect(withPhrase?.doc.id).toBe('d4');
    expect(withPhrase?.why).toContain('exact phrase');
  });

  it('rewards title matches over content-only matches', () => {
    const hits = retrieve('permission service', corpus).hits;
    expect(hits[0]?.doc.id).toBe('w1');
    expect(hits[0]?.why).toContain('in title');
  });

  it('matches inflected terms', () => {
    // "limiting" -> "limit", "handlers" -> "handler"
    expect(retrieve('limit handler', corpus).hits.map((h) => h.doc.id)).toContain('d4');
    // "authenticating" -> "authenticat" still reaches "authentication"
    expect(retrieve('authenticating users', corpus).hits.length).toBeGreaterThan(0);
  });

  it('ranks ProjectBrain ahead of a generic project memory', () => {
    const compound: RetrievalDoc[] = [
      {
        id: 'c1',
        title: 'ProjectBrain owns persistence',
        content: 'ProjectBrain writes the durable planes.',
        kind: 'decision',
      },
      {
        id: 'c2',
        title: 'Project uses a modular layout',
        content: 'The project is split into modules.',
        kind: 'knowledge',
      },
    ];

    const hits = retrieve('ProjectBrain persistence', compound).hits;
    expect(hits[0]?.doc.id).toBe('c1');
  });

  it('gives every hit a positive relevance and an explanation', () => {
    for (const hit of retrieve('rate limiting middleware', corpus).hits) {
      expect(hit.relevance).toBeGreaterThan(0);
      expect(hit.why.length).toBeGreaterThan(0);
    }
  });

  it('returns nothing for a query with no subject terms', () => {
    expect(retrieve('the and of', corpus).hits).toHaveLength(0);
  });

  it('returns nothing when the query matches no memory', () => {
    expect(retrieve('kubernetes helm chart rollout', corpus).hits).toHaveLength(0);
  });

  it('reports honest retrieval stats', () => {
    const { stats } = retrieve('rate limiting MCP handlers', corpus);
    expect(stats.candidates).toBe(corpus.length);
    expect(stats.returned).toBeLessThanOrEqual(stats.candidates);
    expect(stats.discarded).toBe(stats.candidates - stats.returned);
    expect(stats.contentTerms).toContain('rate');
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic', () => {
    const a = retrieve('rate limiting MCP handlers', corpus).hits.map((h) => h.doc.id);
    const b = retrieve('rate limiting MCP handlers', corpus).hits.map((h) => h.doc.id);
    expect(a).toEqual(b);
  });
});

describe('query intent', () => {
  it('classifies modification and location questions', async () => {
    const { classifyIntent } = await import('../src/retrieval/intent.js');
    expect(classifyIntent('Where should I add a payment endpoint?')).toBe('MODIFICATION');
    expect(classifyIntent('Which file should I modify for invoices?')).toBe('MODIFICATION');
    expect(classifyIntent('Add support for cancelling invoices')).toBe('MODIFICATION');
    expect(classifyIntent('Where is authentication implemented?')).toBe('LOCATION');
    expect(classifyIntent('What conventions should I follow?')).toBe('CONVENTION');
    expect(classifyIntent('What rule applies to payment code?')).toBe('CONVENTION');
    expect(classifyIntent('What should I avoid when modifying billing?')).toBe('CONVENTION');
  });
});

describe('location ranking quality', () => {
  it('does not prefer billing-ui/admin satellites over core billing implementation', () => {
    const docs: RetrievalDoc[] = [
      {
        id: 'm-admin',
        title: 'billing-admin → src/billing-admin/',
        content: 'Billing / payments\nLocation: src/billing-admin/',
        kind: 'location',
        location: {
          kind: 'module',
          name: 'billing-admin',
          path: 'src/billing-admin/',
          purpose: 'Billing admin UI (not core billing logic)',
          concepts: ['billing'],
        },
      },
      {
        id: 'm-ui',
        title: 'billing-ui → src/billing-ui/',
        content: 'Billing / payments\nLocation: src/billing-ui/',
        kind: 'location',
        location: {
          kind: 'module',
          name: 'billing-ui',
          path: 'src/billing-ui/',
          purpose: 'Billing UI (not core billing logic)',
          concepts: ['billing'],
        },
      },
      {
        id: 's-billing',
        title: 'BillingService — src/payments-domain/core/service.ts',
        content: 'Exported symbol\nLocation: src/payments-domain/core/service.ts',
        kind: 'location',
        location: {
          kind: 'symbol',
          name: 'BillingService',
          path: 'src/payments-domain/core/service.ts',
          purpose: 'Exported symbol',
          module: 'payments-domain',
          concepts: ['billing'],
        },
      },
      {
        id: 'm-domain',
        title: 'payments-domain → src/payments-domain/',
        content: 'Project module: payments-domain\nLocation: src/payments-domain/',
        kind: 'location',
        location: {
          kind: 'module',
          name: 'payments-domain',
          path: 'src/payments-domain/',
          purpose: 'Project module: payments-domain',
          concepts: ['billing'],
        },
      },
    ];

    const hits = retrieve('Where is billing implemented?', docs).hits;
    expect(hits[0]?.doc.id).toBe('s-billing');
    expect(hits.map((h) => h.doc.id).slice(0, 2)).not.toContain('m-ui');
    expect(hits.map((h) => h.doc.id).slice(0, 2)).not.toContain('m-admin');
  });

  it('prefers domain API routes over health.ts', () => {
    const docs: RetrievalDoc[] = [
      {
        id: 'health',
        title: 'health.ts — src/api/routes/health.ts',
        content: 'API routes / endpoints\nLocation: src/api/routes/health.ts',
        kind: 'location',
        location: {
          kind: 'file',
          name: 'health.ts',
          path: 'src/api/routes/health.ts',
          purpose: 'API routes / endpoints',
          module: 'api',
        },
      },
      {
        id: 'users',
        title: 'users.ts — src/api/routes/users.ts',
        content: 'API routes / endpoints\nLocation: src/api/routes/users.ts',
        kind: 'location',
        location: {
          kind: 'file',
          name: 'users.ts',
          path: 'src/api/routes/users.ts',
          purpose: 'API routes / endpoints',
          module: 'api',
        },
      },
      {
        id: 'billing-routes',
        title: 'routes.ts — src/billing/routes.ts',
        content: 'API routes / endpoints\nLocation: src/billing/routes.ts',
        kind: 'location',
        location: {
          kind: 'file',
          name: 'routes.ts',
          path: 'src/billing/routes.ts',
          purpose: 'API routes / endpoints',
          module: 'billing',
        },
      },
    ];
    const hits = retrieve('Where are API routes defined?', docs).hits;
    expect(hits[0]?.doc.id).not.toBe('health');
  });

  it('prefers src/db over a random repository for database questions', () => {
    const docs: RetrievalDoc[] = [
      {
        id: 'pay-repo',
        title: 'repository.ts — src/payments/repository.ts',
        content: 'Repository / data access\nLocation: src/payments/repository.ts',
        kind: 'location',
        location: {
          kind: 'file',
          name: 'repository.ts',
          path: 'src/payments/repository.ts',
          purpose: 'Repository / data access',
          module: 'payments',
        },
      },
      {
        id: 'db',
        title: 'db → src/db/',
        content: 'Data access\nLocation: src/db/',
        kind: 'location',
        location: {
          kind: 'module',
          name: 'db',
          path: 'src/db/',
          purpose: 'Data access',
          concepts: ['database'],
        },
      },
      {
        id: 'schema',
        title: 'schema.ts — src/db/schema.ts',
        content: 'Database schema or migration\nLocation: src/db/schema.ts',
        kind: 'location',
        location: {
          kind: 'file',
          name: 'schema.ts',
          path: 'src/db/schema.ts',
          purpose: 'Database schema or migration',
          module: 'db',
        },
      },
    ];
    const hits = retrieve('Where is database access?', docs).hits;
    expect(['db', 'schema']).toContain(hits[0]?.doc.id);
  });

  it('boosts remembered payment rules for rule-oriented questions', () => {
    const docs: RetrievalDoc[] = [
      {
        id: 'loc',
        title: 'PaymentService — src/payments/service.ts',
        content: 'Exported symbol\nLocation: src/payments/service.ts',
        kind: 'location',
        location: {
          kind: 'symbol',
          name: 'PaymentService',
          path: 'src/payments/service.ts',
          purpose: 'Exported symbol',
          module: 'payments',
          concepts: ['billing'],
        },
      },
      {
        id: 'rule',
        title: 'Never call Stripe directly from route handlers',
        content: 'Never call Stripe directly from route handlers.',
        kind: 'rule',
        type: 'business_rule',
        tags: ['manual'],
      },
    ];

    const result = retrieve('What rule applies to payment code?', docs);
    expect(result.hits.some((h) => h.doc.id === 'rule')).toBe(true);
  });
});

describe('modification recommendations', () => {
  it('prefers routes when the task is adding an endpoint', async () => {
    const { pickRecommendation } = await import('../src/retrieval/recommend.js');
    const hits = [
      {
        doc: {
          id: 'svc',
          title: 'PaymentService',
          content: 'service',
          kind: 'location' as const,
          location: {
            kind: 'symbol' as const,
            name: 'PaymentService',
            path: 'src/payments/service.ts',
            purpose: 'Exported symbol',
            module: 'payments',
          },
        },
        score: 0.9,
        relevance: 0.9,
        coverage: 1,
        matchedTerms: ['payment'],
        why: 'test',
      },
      {
        doc: {
          id: 'rt',
          title: 'routes.ts',
          content: 'routes',
          kind: 'location' as const,
          location: {
            kind: 'file' as const,
            name: 'routes.ts',
            path: 'src/billing/routes.ts',
            purpose: 'API routes / endpoints',
            module: 'billing',
          },
        },
        score: 0.85,
        relevance: 0.85,
        coverage: 1,
        matchedTerms: ['payment'],
        why: 'test',
      },
    ];
    const rec = pickRecommendation(
      'MODIFICATION',
      hits,
      new Set(['PaymentService', 'routes.ts']),
      'Where should I add a new payment endpoint?',
    );
    expect(rec?.path).toBe('src/billing/routes.ts');
  });
});

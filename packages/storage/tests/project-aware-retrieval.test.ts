import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createNeuronRuntime } from '../src/index.js';

/**
 * Before: AI gets a bare question and rediscovers src/, auth/, billing/, …
 * After: Neuron returns small, path-accurate context for the same questions.
 */

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function shopFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-aware-'));
  temps.push(root);

  for (const dir of [
    'src/auth',
    'src/billing',
    'src/api/routes',
    'src/services',
    'src/repositories',
  ]) {
    await mkdir(join(root, dir), { recursive: true });
  }

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'acme-shop',
      dependencies: {
        express: '^4.19.0',
        stripe: '^17.0.0',
        pg: '^8.13.0',
        'drizzle-orm': '^0.36.0',
      },
    }),
    'utf8',
  );

  await writeFile(
    join(root, 'README.md'),
    [
      '# Acme Shop',
      '',
      '- API handlers use a service layer',
      '- Validation happens before controller execution',
      '- Database access is isolated in repositories',
      '- Never call payment providers from route handlers',
    ].join('\n'),
    'utf8',
  );

  const files: Array<[string, string]> = [
    [
      'src/auth/middleware.ts',
      'export function authenticateRequest() {}\nexport function authMiddleware() {}\n',
    ],
    ['src/auth/service.ts', 'export function createUser() {}\nexport class AuthService {}\n'],
    ['src/billing/stripe.ts', 'export class StripeClient {}\nexport function charge() {}\n'],
    ['src/billing/service.ts', 'export class BillingService {}\n'],
    [
      'src/api/routes/users.ts',
      `import { Router } from 'express';\nexport const router = Router();\nrouter.post('/api/users', () => {});\n`,
    ],
    ['src/api/routes/index.ts', 'export const routes = [];\n'],
    ['src/services/payment-service.ts', 'export class PaymentService {}\n'],
    ['src/repositories/user-repository.ts', 'export class UserRepository {}\n'],
  ];
  for (const [path, body] of files) {
    await writeFile(join(root, path), body, 'utf8');
  }

  return root;
}

describe('project-aware retrieval', () => {
  it('answers location questions with real paths under budget', async () => {
    const cwd = await shopFixture();
    const runtime = await createNeuronRuntime({ cwd });
    const outcome = await runtime.scan('fast');
    expect(outcome.report.map.entries.length).toBeGreaterThan(5);
    expect(runtime.brain.getMap().entries.length).toBeGreaterThan(5);

    const cases: Array<{ q: string; path: RegExp; concept?: RegExp }> = [
      { q: 'Where are API routes defined?', path: /src\/api\/routes/ },
      { q: 'How does authentication work?', path: /src\/auth/, concept: /auth|jwt|middleware/i },
      { q: 'Where is billing implemented?', path: /src\/billing/ },
      { q: 'Where is Stripe configured?', path: /stripe|billing/i },
      { q: 'What database does this project use?', path: /postgres|drizzle|pg/i },
      { q: 'What conventions should I follow?', path: /repositor|service|payment|middleware/i },
      { q: 'What is the architecture of this project?', path: /module|architecture|service/i },
    ];

    for (const c of cases) {
      const prepared = runtime.context({ task: c.q });
      const blob = [
        prepared.context,
        ...prepared.relevantFiles.map((f) => f.path),
        ...prepared.relevantModules.map((m) => m.path),
        ...prepared.relevantRules.map((r) => `${r.title} ${r.detail}`),
      ].join('\n');

      expect(prepared.efficiency.contextTokens, c.q).toBeLessThanOrEqual(
        prepared.efficiency.budgetTokens,
      );
      expect(blob, `missing path for: ${c.q}`).toMatch(c.path);
      if (c.concept) expect(blob, `missing concept for: ${c.q}`).toMatch(c.concept);
      // No ranking metadata in the agent-facing text.
      expect(prepared.context).not.toMatch(/importanceScore|taskRelevance|rankingScore/);
    }

    const noise = runtime.context({ task: 'kubernetes helm chart rollout strategy' });
    expect(noise.context).toMatch(/No stored project knowledge matched/i);
    expect(noise.relevantFiles).toHaveLength(0);
  }, 60_000);

  it('surfaces remembered rules on later related tasks', async () => {
    const cwd = await shopFixture();
    const runtime = await createNeuronRuntime({ cwd });
    await runtime.scan('fast');

    await runtime.engine.createMemory({
      projectId: runtime.project.projectId,
      type: 'business_rule',
      title: 'Never call payment providers from route handlers',
      content:
        'Payment providers (Stripe) must be called from billing services, never from API route handlers.',
      source: 'manual',
      tags: ['billing', 'convention'],
    });

    const hits = runtime.search('call Stripe from route handlers', 5);
    expect(hits.some((h) => /payment providers/i.test(`${h.doc.title} ${h.doc.content}`))).toBe(
      true,
    );

    const prepared = runtime.context({
      task: 'Should I call the payment provider directly from the new route handler?',
    });
    expect(prepared.context).toMatch(/payment|stripe|route/i);
    expect(
      prepared.relevantRules.some((r) => /payment/i.test(`${r.title} ${r.detail}`)) ||
        /payment/i.test(prepared.context),
    ).toBe(true);
  }, 60_000);

  it('recommends where to add a payment endpoint without dumping the tree', async () => {
    const cwd = await shopFixture();
    const runtime = await createNeuronRuntime({ cwd });
    await runtime.scan('fast');

    await runtime.engine.createMemory({
      projectId: runtime.project.projectId,
      type: 'business_rule',
      title: 'Never call the payment provider directly from route handlers',
      content:
        'Payment providers (Stripe) must be called from billing services, never from API route handlers.',
      source: 'manual',
      tags: ['billing', 'convention'],
    });

    const prepared = runtime.context({
      task: 'Where should I add a payment endpoint?',
    });

    expect(prepared.intent).toBe('MODIFICATION');
    expect(prepared.recommendation?.path).toMatch(/billing|payment|api\/routes/i);
    expect(prepared.context).toMatch(/Recommended start|src\//i);
    expect(prepared.efficiency.contextTokens).toBeLessThanOrEqual(500);
    expect(prepared.efficiency.corpusTokens).toBeGreaterThan(prepared.efficiency.contextTokens);
    // Must not dump unrelated modules as if listing the whole tree.
    expect(prepared.context).not.toMatch(/src\/auth\/middleware/i);
  }, 60_000);

  it('removes deleted paths from the map on rescan', async () => {
    const cwd = await shopFixture();
    const runtime = await createNeuronRuntime({ cwd });
    await runtime.scan('fast');
    expect(runtime.brain.getMap().entries.some((e) => e.path.includes('billing'))).toBe(true);

    await rm(join(cwd, 'src', 'billing'), { recursive: true, force: true });
    await runtime.scan('fast');

    expect(runtime.brain.getMap().entries.some((e) => e.path.includes('src/billing'))).toBe(false);
  }, 60_000);
});

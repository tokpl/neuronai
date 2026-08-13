import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runInit } from '../src/commands/init.js';
import { runDoctorChecks } from '../src/diagnostics/doctor-checks.js';
import { openProjectSession } from '../src/services/project-session.js';

/**
 * The journey a new user actually takes: install, init, scan, ask a question,
 * get relevant project knowledge, hand it to Cursor.
 *
 * The original MVP could report "scan succeeded" while search knew nothing.
 * These assertions exist so that can never ship again.
 */

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function realisticProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-golden-'));
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
      version: '2.1.0',
      dependencies: { next: '^15.0.0', 'drizzle-orm': '^0.36.0', pg: '^8.13.0', stripe: '^17.0.0' },
      devDependencies: { typescript: '^5.6.0' },
    }),
    'utf8',
  );

  await writeFile(
    join(root, 'README.md'),
    [
      '# Acme Shop',
      '',
      'Storefront for Acme.',
      '',
      '## Architecture',
      '',
      '- Authentication is JWT-based and enforced in middleware, never in route handlers.',
      '- Billing runs through Stripe webhooks; we never store card data.',
      '- PostgreSQL is the system of record. Avoid dual-writes to other stores.',
      '- Controllers must not touch the database directly - go through repositories.',
    ].join('\n'),
    'utf8',
  );

  const files: Array<[string, string]> = [
    ['src/auth/jwt.ts', 'export function signToken() {}'],
    ['src/auth/middleware.ts', 'export function authMiddleware() {}'],
    ['src/billing/stripe-webhook.ts', 'export function stripeWebhook() {}'],
    ['src/api/routes/index.ts', 'export const routes = [];'],
    ['src/services/order-service.ts', 'export class OrderService {}'],
    ['src/services/user-service.ts', 'export class UserService {}'],
    ['src/services/payment-service.ts', 'export class PaymentService {}'],
    ['src/repositories/order-repository.ts', 'export class OrderRepository {}'],
  ];
  for (const [path, body] of files) {
    await writeFile(join(root, path), body, 'utf8');
  }

  return root;
}

describe('golden path: init → scan → search → context', () => {
  it('takes a stranger from an unknown project to relevant answers', async () => {
    const root = await realisticProject();

    // --- init -------------------------------------------------------------
    await runInit(root, { yes: true });

    const session = await openProjectSession(root);
    const memories = session.listMemories();

    expect(memories.length).toBeGreaterThan(5);
    expect(session.brain.status().healthPercent).toBeGreaterThan(0);

    // --- the project was actually understood ------------------------------
    const modules = session.brain.dna.structure.modules?.value ?? [];
    expect(modules).toEqual(expect.arrayContaining(['auth', 'billing', 'services']));

    // --- scan must feed search, never just write files --------------------
    // This is the regression that shipped in the MVP.
    for (const memory of memories) {
      const hits = session.search(memory.title, 10);
      expect(
        hits.some((h) => h.doc.id === memory.id),
        `stored memory is not searchable: "${memory.title}"`,
      ).toBe(true);
    }

    // --- project map is populated with real paths ------------------------
    const map = session.brain.getMap();
    expect(map.entries.length).toBeGreaterThan(3);
    expect(map.entries.some((e) => e.path.includes('src/auth'))).toBe(true);
    expect(map.entries.some((e) => e.path.includes('src/billing'))).toBe(true);
    expect(map.entries.filter((e) => e.path.includes('src/')).length).toBeGreaterThan(0);

    // --- real questions get the right answers -----------------------------
    const expectations: Array<[string, RegExp]> = [
      ['Where is authentication implemented?', /auth/i],
      ['How does authentication work?', /auth|jwt|middleware/i],
      ['Where is billing implemented?', /billing|stripe/i],
      ['Where is Stripe configured?', /stripe|billing/i],
      ['What database does this project use?', /postgres/i],
      ['Why is PostgreSQL used?', /postgres/i],
      ['Where are API routes defined?', /route|api/i],
      ['What conventions should I follow?', /repositor|service|postgres|middleware|frontend/i],
      ['What is the architecture of this project?', /module|architecture|service/i],
    ];

    for (const [question, expected] of expectations) {
      const hits = session.search(question, 5);
      expect(hits.length, `no results for: ${question}`).toBeGreaterThan(0);
      const blob = hits.map((h) => `${h.doc.title} ${h.doc.content}`).join('\n');
      expect(blob, `wrong results for: ${question}`).toMatch(expected);

      const prepared = session.context({ task: question });
      expect(prepared.efficiency.contextTokens).toBeLessThanOrEqual(
        prepared.efficiency.budgetTokens,
      );
      expect(prepared.context, `empty context for: ${question}`).not.toMatch(
        /No stored project knowledge matched/i,
      );
    }

    // --- an unrelated question must return nothing, not noise -------------
    expect(session.search('kubernetes helm chart rollout strategy', 5)).toHaveLength(0);
    const unrelated = session.context({ task: 'kubernetes helm chart rollout strategy' });
    expect(unrelated.context).toMatch(/No stored project knowledge matched/i);

    // --- compiled context is small, relevant and clean --------------------
    const context = session.context({ task: 'add rate limiting to the billing webhook' });
    expect(context.metrics.compiledTokens).toBeLessThanOrEqual(500);
    expect(context.efficiency.baseline).toBe('matched-knowledge-verbatim');
    // Matched knowledge only — must not look like a constant ~20–30k location-index "save".
    expect(context.efficiency.corpusTokens).toBeLessThan(8_000);
    expect(context.efficiency.estimatedTokensSaved).toBe(
      Math.max(0, context.efficiency.corpusTokens - context.efficiency.contextTokens),
    );
    expect(context.context).toMatch(/billing|stripe|webhook/i);
    expect(context.context).not.toMatch(/importanceScore|taskRelevance|rankingScore/);
    expect(context.context).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    // Prefer locations over dumping the whole tree.
    expect(context.context).not.toMatch(/src\/repositories\/order-repository/i);

    // --- doctor agrees the install is healthy -----------------------------
    const checks = await runDoctorChecks(root);
    const failed = checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    expect(failed).toEqual([]);
    expect(checks.find((c) => c.name === 'Retrieval')?.ok).toBe(true);
    expect(checks.find((c) => c.name === 'Project map')?.ok).toBe(true);
    expect(checks.find((c) => c.name === 'Context budget')?.ok).toBe(true);

    // --- Cursor is wired ---------------------------------------------------
    const mcp = checks.find((c) => c.name === 'Cursor integration / MCP');
    expect(mcp?.ok).toBe(true);
  }, 60_000);

  it('re-running scan does not duplicate what it already knows', async () => {
    const root = await realisticProject();
    await runInit(root, { yes: true });

    const session = await openProjectSession(root);
    const before = session.listMemories().length;

    const again = await session.scan('fast');

    expect(again.memoriesStored).toBe(0);
    expect(again.duplicatesSkipped).toBeGreaterThan(0);
    expect(session.listMemories()).toHaveLength(before);
  }, 60_000);
});

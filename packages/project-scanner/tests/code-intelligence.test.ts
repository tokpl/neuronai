import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildCodeIntelligence } from '../src/code/intelligence.js';
import type { ScannedFile } from '../src/types.js';

async function fixture(): Promise<{ root: string; files: ScannedFile[] }> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-code-'));
  await mkdir(join(root, 'src', 'billing'), { recursive: true });
  await mkdir(join(root, 'src', 'api'), { recursive: true });

  await writeFile(
    join(root, 'src', 'billing', 'service.ts'),
    `export class BillingService {
  createInvoice() { return 1; }
  cancelInvoice() { return 2; }
}
`,
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'billing', 'stripe.ts'),
    `export class StripeClient {
  charge() { return true; }
}
`,
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'api', 'routes.ts'),
    `import { BillingService } from '../billing/service';
import { Router } from 'express';

const router = Router();
const billing = new BillingService();

export function mount(app: { use: Function }) {
  router.post('/payments', createPayment);
  app.use(router);
}

export function createPayment() {
  return billing.createInvoice();
}
`,
    'utf8',
  );

  const files: ScannedFile[] = [
    file(root, 'src/billing/service.ts'),
    file(root, 'src/billing/stripe.ts'),
    file(root, 'src/api/routes.ts'),
  ];
  return { root, files };
}

function file(root: string, relativePath: string): ScannedFile {
  return {
    relativePath,
    absolutePath: join(root, relativePath),
    ext: '.ts',
    size: 100,
    mtimeMs: Date.now(),
    importance: 'HIGH',
    language: 'typescript',
  };
}

describe('code intelligence', () => {
  it('extracts exports and verified IMPORTS / CALLS with evidence', async () => {
    const { files } = await fixture();
    const code = await buildCodeIntelligence(files, {
      allPaths: new Set(files.map((f) => f.relativePath)),
    });

    expect(code.symbols.some((s) => s.name === 'BillingService')).toBe(true);
    expect(code.symbols.some((s) => s.name === 'cancelInvoice' && s.parent === 'BillingService')).toBe(
      true,
    );

    const imports = code.edges.filter((e) => e.type === 'IMPORTS' && e.confidence === 'high');
    expect(imports.some((e) => e.from.includes('routes.ts') && e.to.includes('billing/service'))).toBe(
      true,
    );

    const calls = code.edges.filter((e) => e.type === 'CALLS');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((e) => e.evidence?.detail)).toBe(true);
    expect(calls.every((e) => e.confidence === 'high' || e.confidence === 'medium')).toBe(true);
    // No low-confidence CALLS stored
    expect(calls.every((e) => e.confidence !== 'low')).toBe(true);
  });

  it('resolves TypeScript ESM .js import specs to .ts files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-code-esm-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(
      join(root, 'src', 'a.ts'),
      `export class Alpha {\n  run() { return 1; }\n}\nexport function helper() { return 2; }\n`,
      'utf8',
    );
    await writeFile(
      join(root, 'src', 'b.ts'),
      `import { Alpha, helper } from './a.js';\nconst alpha = new Alpha();\nexport function use() {\n  alpha.run();\n  helper();\n}\n`,
      'utf8',
    );
    const files: ScannedFile[] = [file(root, 'src/a.ts'), file(root, 'src/b.ts')];
    const code = await buildCodeIntelligence(files, {
      allPaths: new Set(files.map((f) => f.relativePath)),
    });

    expect(
      code.edges.some(
        (e) => e.type === 'IMPORTS' && e.from === 'src/b.ts' && e.to === 'src/a.ts',
      ),
    ).toBe(true);
    expect(code.edges.some((e) => e.type === 'CALLS' && /Alpha\.run|helper/.test(e.to))).toBe(true);
    expect(code.edges.filter((e) => e.type === 'CALLS' && /Mystery/i.test(JSON.stringify(e)))).toHaveLength(
      0,
    );
  });

  it('does not invent CALLS to unresolved symbols', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-code-empty-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(
      join(root, 'src', 'lonely.ts'),
      `export function alone() { return MysteryService.doThing(); }\n`,
      'utf8',
    );
    const files = [file(root, 'src/lonely.ts')];
    const code = await buildCodeIntelligence(files, {
      allPaths: new Set(['src/lonely.ts']),
    });
    expect(code.edges.filter((e) => e.type === 'CALLS')).toHaveLength(0);
  });
});

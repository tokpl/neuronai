import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createProjectResolver,
  detectProjectStack,
  projectIdFromSlug,
} from '../src/index.js';

describe('FilesystemProjectResolver', () => {
  it('resolves the current workspace', async () => {
    const resolved = await createProjectResolver().resolve(process.cwd());
    expect(resolved.name.length).toBeGreaterThan(0);
    expect(resolved.projectId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(resolved.stack.length).toBeGreaterThan(0);
    expect(resolved.languages.length).toBeGreaterThan(0);
  });

  it('creates stable project ids', () => {
    expect(projectIdFromSlug('demo')).toBe(projectIdFromSlug('demo'));
  });

  it('detects nextjs + postgresql + pnpm', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-analyzer-'));
    try {
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'app',
          dependencies: { next: '16.0.0', react: '19.0.0', pg: '8.13.0' },
        }),
        'utf8',
      );
      await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n', 'utf8');
      await mkdir(join(root, 'apps'), { recursive: true });
      await mkdir(join(root, 'packages'), { recursive: true });

      const stack = await detectProjectStack(root);
      expect(stack.frameworks).toContain('nextjs');
      expect(stack.databases).toContain('postgresql');
      expect(stack.packageManagers).toContain('pnpm');
      expect(stack.structureNotes.some((n) => /Next\.js/i.test(n))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

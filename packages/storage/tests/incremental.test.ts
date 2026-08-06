import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createNeuronRuntime } from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-incr-'));
  temps.push(root);
  await mkdir(join(root, 'src', 'auth'), { recursive: true });
  await mkdir(join(root, 'src', 'billing'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'incr-app', dependencies: { next: '^15.0.0' } }),
    'utf8',
  );
  await writeFile(join(root, 'src', 'auth', 'jwt.ts'), 'export function sign() {}', 'utf8');
  await writeFile(join(root, 'src', 'billing', 'stripe.ts'), 'export function pay() {}', 'utf8');
  return root;
}

describe('incremental scan', () => {
  it('skips re-analysis when nothing changed', async () => {
    const cwd = await project();
    const runtime = await createNeuronRuntime({ cwd });

    await runtime.scan('fast');
    const update = await runtime.scan('update');

    expect(update.report.unchanged).toBe(true);
    expect(update.memoriesStored).toBe(0);
    expect(update.report.delta?.reanalyzed).toBe(0);
  });

  it('does not erase the brain when the update is a no-op', async () => {
    const cwd = await project();
    const runtime = await createNeuronRuntime({ cwd });

    await runtime.scan('fast');
    const modulesBefore = runtime.brain.dna.structure.modules?.value ?? [];
    const nodesBefore = runtime.brain.knowledge.graph.nodes.length;
    const memoriesBefore = runtime.listMemories().length;

    expect(modulesBefore.length).toBeGreaterThan(0);

    await runtime.scan('update');

    expect(runtime.brain.dna.structure.modules?.value).toEqual(modulesBefore);
    expect(runtime.brain.knowledge.graph.nodes).toHaveLength(nodesBefore);
    expect(runtime.listMemories()).toHaveLength(memoriesBefore);
  });

  it('picks up a genuinely new module', async () => {
    const cwd = await project();
    const runtime = await createNeuronRuntime({ cwd });
    await runtime.scan('fast');

    await mkdir(join(cwd, 'src', 'search'), { recursive: true });
    await writeFile(join(cwd, 'src', 'search', 'index.ts'), 'export const q = 1;', 'utf8');

    const update = await runtime.scan('update');

    expect(update.report.unchanged).toBeFalsy();
    expect(runtime.brain.dna.structure.modules?.value).toContain('search');
  });
});

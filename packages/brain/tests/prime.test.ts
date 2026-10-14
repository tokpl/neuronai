import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { openProjectBrain, runPrime, isPrimed, emptyBoard, writeWorkflowBoard } from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('runPrime', () => {
  it('writes workflow prefs and PROJECT_MAP.md', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-prime-'));
    temps.push(root);
    await mkdir(join(root, '.neuron'), { recursive: true });
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'demo',
        scripts: { test: 'vitest', lint: 'eslint .', typecheck: 'tsc -p .' },
      }),
      'utf8',
    );
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n', 'utf8');

    const brain = await openProjectBrain(root, {
      seed: { projectId: 'demo', name: 'demo', stack: ['typescript'] },
    });
    const result = await runPrime(brain);

    expect(result.conventions.packageManager).toBe('pnpm');
    expect(result.conventions.scripts.test).toBe('pnpm test');
    expect(isPrimed(brain)).toBe(true);

    const prefs = JSON.parse(await readFile(result.prefsPath, 'utf8')) as {
      workflow: { primedAt: string; scripts: { test: string } };
    };
    expect(prefs.workflow.primedAt).toBeTruthy();
    expect(prefs.workflow.scripts.test).toBe('pnpm test');

    const map = await readFile(result.projectMapPath, 'utf8');
    expect(map).toMatch(/Project map/);
    expect(map).toMatch(/pnpm/);
  });

  it('writes workflow board json + md', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-board-'));
    temps.push(root);
    await mkdir(join(root, '.neuron'), { recursive: true });
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'b', name: 'b', stack: ['ts'] },
    });
    const path = await writeWorkflowBoard(
      brain,
      emptyBoard('Ship rate limiting', { test: 'pnpm test' }),
    );
    expect(path).toMatch(/board\.json$/);
    const board = JSON.parse(await readFile(path, 'utf8')) as { goal: string; phase: string };
    expect(board.goal).toMatch(/rate limiting/);
    expect(board.phase).toBe('clarify');
    const md = await readFile(join(brain.paths.workflowDir, 'board.md'), 'utf8');
    expect(md).toMatch(/Neuron deliver board/);
    expect(md).toMatch(/Brain grounding/);
    expect(md).toMatch(/Remembered/);
  });
});

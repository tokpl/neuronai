import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  answerDeliverGate,
  clearDeliverGate,
  isGateActive,
  openProjectBrain,
  readDeliverGate,
  writeDeliverGate,
} from '../src/index.js';

describe('deliver gate', () => {
  it('persists and clears when all questions answered', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-gate-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'g', name: 'g', stack: ['ts'] },
    });

    await writeDeliverGate(brain, {
      reason: 'clarify',
      until: 'clarify-answered',
      questionIds: ['scope', 'risk'],
      task: 'Add auth',
      playbook: 'build',
    });

    let gate = await readDeliverGate(brain);
    expect(isGateActive(gate)).toBe(true);
    const raw = await readFile(brain.paths.workflowGate, 'utf8');
    expect(raw).toMatch(/scope/);

    let r = await answerDeliverGate(brain, 'scope');
    expect(r.cleared).toBe(false);
    expect(isGateActive(r.gate)).toBe(true);

    r = await answerDeliverGate(brain, 'risk');
    expect(r.cleared).toBe(true);
    expect(await readDeliverGate(brain)).toBeNull();

    await writeDeliverGate(brain, {
      reason: 'x',
      until: 'clarify-answered',
      questionIds: ['a'],
    });
    await clearDeliverGate(brain);
    expect(await readDeliverGate(brain)).toBeNull();
  });
});

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openProjectBrain, playbookChecklist, proposeDeliverWaves } from '../src/index.js';

describe('proposeDeliverWaves', () => {
  it('returns ordered build waves with dependsOn', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-waves-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'w', name: 'w', stack: ['ts'] },
    });
    const { waves } = proposeDeliverWaves(brain, {
      goal: 'Add rate limiting',
      playbook: 'build',
      seedPath: 'src/mw.ts',
    });
    expect(waves.length).toBeGreaterThanOrEqual(2);
    expect(waves[0]?.id).toBe('w1');
    const verify = waves.find((w) => w.title.toLowerCase().includes('verify'));
    expect(verify?.dependsOn?.length).toBeGreaterThan(0);
  });

  it('exposes playbook checklists', () => {
    expect(playbookChecklist('ui').some((c) => c.id === 'a11y')).toBe(true);
    expect(playbookChecklist('ui').some((c) => c.id === 'responsive')).toBe(true);
    expect(playbookChecklist('ui').some((c) => c.id === 'journey-ok')).toBe(true);
    expect(playbookChecklist('ui').some((c) => c.id === 'no-fantasy')).toBe(true);
    expect(playbookChecklist('build').some((c) => c.id === 'no-fantasy')).toBe(true);
    expect(playbookChecklist('docs').some((c) => c.id === 'cited')).toBe(true);
    expect(playbookChecklist('docs').some((c) => c.id === 'no-invent')).toBe(true);
  });

  it('incident runbook orders reproduce before fix before verify', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-waves-incident-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'wi', name: 'wi', stack: ['ts'] },
    });
    const { waves, runbook } = proposeDeliverWaves(brain, {
      goal: 'Hotfix P0 outage in auth',
      playbook: 'build',
      runbook: 'incident',
      seedPath: 'src/auth.ts',
    });
    expect(runbook).toBe('incident');
    expect(waves.map((w) => w.title)).toEqual([
      'Reproduce',
      'Fix',
      'Verify',
      'Remember postmortem',
    ]);
    expect(waves[1]?.dependsOn).toEqual(['w1']);
  });

  it('enterprise-change runbook differs from default feature build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-waves-ent-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'we', name: 'we', stack: ['ts'] },
    });
    const feature = proposeDeliverWaves(brain, {
      goal: 'Add rate limiting',
      playbook: 'build',
      runbook: 'feature',
      seedPath: 'src/mw.ts',
    });
    const enterprise = proposeDeliverWaves(brain, {
      goal: 'Add rate limiting for compliance',
      playbook: 'build',
      runbook: 'enterprise-change',
      seedPath: 'src/mw.ts',
    });
    expect(feature.runbook).toBe('feature');
    expect(enterprise.runbook).toBe('enterprise-change');
    expect(enterprise.waves[0]?.title).toMatch(/scope/i);
    expect(enterprise.waves.map((w) => w.title)).not.toEqual(
      feature.waves.map((w) => w.title),
    );
  });

  it('refuses with PROPOSE_NEEDS_CODE when code intel exists but seedPath does not resolve', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-waves-code-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'w2', name: 'w2', stack: ['ts'] },
    });
    await brain.updateCode({
      version: 1,
      updatedAt: new Date().toISOString(),
      files: [
        {
          path: 'src/billing/service.ts',
          role: 'service',
          imports: [],
          exports: ['BillingService'],
        },
      ],
      symbols: [],
      edges: [],
    });

    try {
      proposeDeliverWaves(brain, {
        goal: 'Change billing',
        playbook: 'build',
        seedPath: 'src/does-not-exist.ts',
      });
      expect.fail('expected PROPOSE_NEEDS_CODE');
    } catch (e) {
      expect(e).toMatchObject({ code: 'PROPOSE_NEEDS_CODE' });
      expect(String(e)).toMatch(/seedPath did not resolve/i);
    }

    const ok = proposeDeliverWaves(brain, {
      goal: 'Change billing',
      playbook: 'build',
      seedPath: 'src/billing/service.ts',
    });
    expect(ok.quality).toBe('code');
    expect(ok.usedCode).toBe(true);
  });
});

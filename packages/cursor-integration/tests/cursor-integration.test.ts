import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createContextBudgetManager,
  inferTaskSize,
  installCursorIntegration,
  mergeNeuronMcpConfig,
  runCursorDoctorChecks,
  validateCursorMcpConfig,
  writeProjectBrainFiles,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('mcp config', () => {
  it('builds and validates neuron entry', () => {
    const merged = mergeNeuronMcpConfig({}, '/proj');
    const v = validateCursorMcpConfig(merged);
    expect(v.ok).toBe(true);
    expect(v.neuron?.args).toContain('mcp');
    // Monorepo: node + apps/cli/dist; published: npx neuronai
    const cmd = v.neuron?.command ?? '';
    const ok =
      cmd === process.execPath ||
      cmd === 'npx' ||
      cmd === 'npx.cmd' ||
      /node(\.exe)?$/i.test(cmd);
    expect(ok).toBe(true);
  });

  it('rejects missing neuron server', () => {
    const v = validateCursorMcpConfig({ mcpServers: {} });
    expect(v.ok).toBe(false);
  });
});

describe('context budget', () => {
  it('caps items and tokens for small tasks', () => {
    const mgr = createContextBudgetManager();
    const candidates = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      title: `Memory ${i} about auth jwt rbac`,
      content: 'x'.repeat(400),
      score: 1 - i * 0.01,
    }));
    const sel = mgr.select(candidates, 'small');
    expect(sel.selected.length).toBeLessThanOrEqual(5);
    expect(sel.tokenEstimate).toBeLessThanOrEqual(2_000);
    expect(sel.briefing).toMatch(/Top context/);
  });

  it('infers architecture size', () => {
    expect(inferTaskSize('Redesign the platform authentication architecture')).toBe(
      'architecture',
    );
    expect(inferTaskSize('fix typo in README')).toBe('small');
  });
});

describe('cursor install + doctor', () => {
  it('installs mcp, rules, skill, commands and passes doctor after brain files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-cursor-'));
    temps.push(root);
    await mkdir(join(root, '.neuron'), { recursive: true });

    const installed = await installCursorIntegration(root, { force: true });
    expect(installed.mcpValid).toBe(true);

    const mcp = JSON.parse(await readFile(installed.mcpPath, 'utf8')) as {
      mcpServers: { neuron: { command: string; args: string[] } };
    };
    const cmd = mcp.mcpServers.neuron.command;
    expect(
      cmd === process.execPath ||
        cmd === 'npx' ||
        cmd === 'npx.cmd' ||
        /node(\.exe)?$/i.test(cmd),
    ).toBe(true);
    expect(mcp.mcpServers.neuron.args).toContain('mcp');

    const rules = await readFile(installed.rulesPath, 'utf8');
    expect(rules).toMatch(/BEFORE coding/);
    const skill = await readFile(installed.skillPath, 'utf8');
    expect(skill).toMatch(/neuron_get_context/);

    await writeProjectBrainFiles(join(root, '.neuron'), {
      projectId: 'p1',
      projectName: 'demo',
      stack: ['typescript'],
      decisions: [{ title: 'Use JWT', content: 'RBAC on API' }],
    });

    const report = await runCursorDoctorChecks(root);
    expect(report.ok).toBe(true);
  });
});

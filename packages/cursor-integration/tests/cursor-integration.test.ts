import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
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
      cmd === process.execPath || cmd === 'npx' || cmd === 'npx.cmd' || /node(\.exe)?$/i.test(cmd);
    expect(ok).toBe(true);
  });

  it('rejects missing neuron server', () => {
    const v = validateCursorMcpConfig({ mcpServers: {} });
    expect(v.ok).toBe(false);
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
      cmd === process.execPath || cmd === 'npx' || cmd === 'npx.cmd' || /node(\.exe)?$/i.test(cmd),
    ).toBe(true);
    expect(mcp.mcpServers.neuron.args).toContain('mcp');

    const rules = await readFile(installed.rulesPath, 'utf8');
    expect(rules).toMatch(/Before coding/);
    const skill = await readFile(installed.skillPath, 'utf8');
    expect(skill).toMatch(/neuron_context/);

    await writeProjectBrainFiles(join(root, '.neuron'), {
      projectId: 'p1',
      projectName: 'demo',
      stack: ['typescript'],
    });

    const report = await runCursorDoctorChecks(root);
    const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('only references tools that the MCP server actually registers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-cursor-tools-'));
    temps.push(root);
    const installed = await installCursorIntegration(root, { force: true });

    const registered = [
      'neuron_context',
      'neuron_search',
      'neuron_remember',
      'neuron_update',
      'neuron_after_task',
      'neuron_resolve_suggestion',
      'neuron_scan',
    ];

    const texts = [
      await readFile(installed.rulesPath, 'utf8'),
      await readFile(installed.skillPath, 'utf8'),
      await readFile(join(installed.commandsDir, 'neuron-context.md'), 'utf8'),
      await readFile(join(installed.commandsDir, 'neuron-save.md'), 'utf8'),
      await readFile(join(installed.commandsDir, 'neuron-explain.md'), 'utf8'),
    ].join('\n');

    const mentioned = [...texts.matchAll(/neuron_[a-z_]+/g)].map((m) => m[0]);
    const unknown = [...new Set(mentioned)].filter((t) => !registered.includes(t));
    expect(unknown).toEqual([]);
  });

  it('rewrites stale guidance that still names retired MCP tools', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-cursor-stale-'));
    temps.push(root);
    await mkdir(join(root, '.cursor', 'rules'), { recursive: true });
    await mkdir(join(root, '.cursor', 'skills', 'neuron-memory'), { recursive: true });
    await mkdir(join(root, '.cursor', 'commands'), { recursive: true });

    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      join(root, '.cursor', 'rules', 'neuron-memory.mdc'),
      'Call `neuron_prepare_task` before coding.\n',
      'utf8',
    );
    await writeFile(
      join(root, '.cursor', 'skills', 'neuron-memory', 'SKILL.md'),
      'Use neuron_get_context and neuron_search_memory.\n',
      'utf8',
    );
    await writeFile(
      join(root, '.cursor', 'commands', 'neuron-context.md'),
      '1. Call `neuron_prepare_task`\n',
      'utf8',
    );

    // Without --force: stale markers alone must trigger a rewrite.
    await installCursorIntegration(root, { force: false });

    const rules = await readFile(join(root, '.cursor', 'rules', 'neuron-memory.mdc'), 'utf8');
    expect(rules).toMatch(/neuron_context/);
    expect(rules).not.toMatch(/neuron_prepare_task/);

    const report = await runCursorDoctorChecks(root);
    expect(report.checks.find((c) => c.name === 'Neuron rules')?.ok).toBe(true);
    expect(report.checks.find((c) => c.name === 'Neuron skill')?.ok).toBe(true);
    expect(report.checks.find((c) => c.name === 'Cursor commands')?.ok).toBe(true);
  });
});

import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installAntigravityIntegration,
  mergeGlobalAntigravityMcp,
  runAntigravityDoctorChecks,
  writeProjectBrainFiles,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('mergeGlobalAntigravityMcp', () => {
  it('adds neuron when missing', () => {
    const merged = mergeGlobalAntigravityMcp({}, '/proj-a', { workspaceConfigured: true });
    const neuron = merged.mcpServers['neuron'] as { env: { NEURON_CWD: string } };
    expect(neuron.env.NEURON_CWD).toBe('/proj-a');
  });

  it('migrates NEURON_PROJECT_ROOT to NEURON_CWD', () => {
    const merged = mergeGlobalAntigravityMcp(
      {
        mcpServers: {
          neuron: {
            command: 'npx',
            args: ['-y', 'neuronai', 'mcp'],
            env: { NEURON_PROJECT_ROOT: '/old' },
          },
          other: { command: 'echo' },
        },
      },
      '/new',
      { workspaceConfigured: false },
    );
    const neuron = merged.mcpServers['neuron'] as {
      env: Record<string, string>;
    };
    expect(neuron.env.NEURON_CWD).toBe('/old');
    expect(neuron.env.NEURON_PROJECT_ROOT).toBeUndefined();
    expect(merged.mcpServers['other']).toEqual({ command: 'echo' });
  });

  it('does not clobber existing NEURON_CWD when workspace is configured', () => {
    const merged = mergeGlobalAntigravityMcp(
      {
        mcpServers: {
          neuron: {
            command: 'npx',
            args: ['-y', 'neuronai', 'mcp'],
            env: { NEURON_CWD: '/other-project' },
          },
        },
      },
      '/this-project',
      { workspaceConfigured: true },
    );
    const neuron = merged.mcpServers['neuron'] as { env: { NEURON_CWD: string } };
    expect(neuron.env.NEURON_CWD).toBe('/other-project');
  });
});

describe('antigravity install + doctor', () => {
  it(
    'installs workspace MCP with NEURON_CWD, always_on rule, skill, AGENTS.md',
    async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-ag-'));
    temps.push(root);
    await mkdir(join(root, '.neuron'), { recursive: true });

    const installed = await installAntigravityIntegration(root, { force: true });
    expect(installed.mcpConfigured).toBe(true);

    const mcp = JSON.parse(await readFile(installed.workspaceMcpPath, 'utf8')) as {
      mcpServers: { neuron: { env: { NEURON_CWD?: string; NEURON_PROJECT_ROOT?: string } } };
    };
    expect(mcp.mcpServers.neuron.env.NEURON_CWD).toBe(root);
    expect(mcp.mcpServers.neuron.env.NEURON_PROJECT_ROOT).toBeUndefined();

    const rules = await readFile(installed.rulesPath, 'utf8');
    expect(rules).toMatch(/trigger:\s*always_on/);
    expect(rules).toMatch(/Before broad repository exploration/);
    expect(rules).not.toMatch(/alwaysApply/);
    expect(rules).not.toMatch(/AskQuestion/);

    const skill = await readFile(installed.skillPath, 'utf8');
    expect(skill).toMatch(/neuron_context/);
    expect(skill).toMatch(/Antigravity/);
    expect(skill).not.toMatch(/AskQuestion/);

    await expect(
      readFile(join(root, '.agents', 'skills', 'neuron-prime', 'SKILL.md'), 'utf8'),
    ).rejects.toThrow();
    const deliver = await readFile(
      join(root, '.agents', 'skills', 'neuron-deliver', 'SKILL.md'),
      'utf8',
    );
    expect(deliver).toMatch(/neuron_after_task/);
    expect(deliver).toMatch(/neuron init/);

    const agents = await readFile(installed.agentsMdPath, 'utf8');
    expect(agents).toContain('<!-- neuron-memory:start -->');
    expect(agents).toContain('<!-- neuron-memory:end -->');
    expect(agents).toContain('neuron_context');

    await writeProjectBrainFiles(join(root, '.neuron'), {
      projectId: 'p1',
      projectName: 'demo',
      stack: ['typescript'],
    });

    const report = await runAntigravityDoctorChecks(root);
    const failed = report.checks
      .filter((c) => !c.ok && c.name !== 'Global MCP fallback' && c.name !== 'MCP stdio probe')
      .map((c) => `${c.name}: ${c.detail}`);
    // Stdio probe may fail in CI without built CLI; core file checks must pass.
    expect(failed).toEqual([]);
    expect(report.checks.find((c) => c.name === 'Neuron rules')?.ok).toBe(true);
    expect(report.checks.find((c) => c.name === 'Neuron skills')?.ok).toBe(true);
    expect(report.checks.find((c) => c.name === 'NEURON_CWD on workspace MCP')?.ok).toBe(true);
  },
    30_000,
  );

  it('rewrites stale rules missing trigger: always_on without --force', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-ag-stale-'));
    temps.push(root);
    await mkdir(join(root, '.agents', 'rules'), { recursive: true });
    await mkdir(join(root, '.agents', 'skills', 'neuron-memory'), { recursive: true });

    await writeFile(
      join(root, '.agents', 'rules', 'neuron-memory.md'),
      '---\nalwaysApply: true\n---\nCall `neuron_prepare_task` before coding.\n',
      'utf8',
    );
    await writeFile(
      join(root, '.agents', 'skills', 'neuron-memory', 'SKILL.md'),
      'Use neuron_get_context.\n',
      'utf8',
    );

    await installAntigravityIntegration(root, { force: false });

    const rules = await readFile(join(root, '.agents', 'rules', 'neuron-memory.md'), 'utf8');
    expect(rules).toMatch(/trigger:\s*always_on/);
    expect(rules).toMatch(/neuron_context/);
    expect(rules).not.toMatch(/neuron_prepare_task/);
    expect(rules).not.toMatch(/alwaysApply/);
  });

  it('upserts AGENTS.md marked block without wiping user content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-ag-agents-'));
    temps.push(root);
    await writeFile(join(root, 'AGENTS.md'), '# Team rules\n\nUse pnpm.\n', 'utf8');

    await installAntigravityIntegration(root, { force: true });
    const first = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(first).toContain('# Team rules');
    expect(first).toContain('<!-- neuron-memory:start -->');

    await writeFile(
      join(root, 'AGENTS.md'),
      first.replace('neuron_context', 'STALE_MARKER_SHOULD_REFRESH'),
      'utf8',
    );
    // force refreshes block when neuron_context missing from markers section path —
    // our needsAgents checks neuron_context in whole file
    await installAntigravityIntegration(root, { force: true });
    const second = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(second).toContain('# Team rules');
    expect(second).toContain('neuron_context');
    expect(second).not.toContain('STALE_MARKER_SHOULD_REFRESH');
  });
});

describe('homedir global path smoke', () => {
  it('writes under ~/.gemini/config when installing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-ag-global-'));
    temps.push(root);
    const installed = await installAntigravityIntegration(root, { force: true });
    expect(installed.globalMcpPath).toBe(join(homedir(), '.gemini', 'config', 'mcp_config.json'));
    const globalRaw = await readFile(installed.globalMcpPath, 'utf8');
    const global = JSON.parse(globalRaw) as { mcpServers: { neuron?: unknown } };
    expect(global.mcpServers.neuron).toBeTruthy();
  });
});

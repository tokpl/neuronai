import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCli } from '../src/index.js';
import { runDoctor } from '../src/commands/doctor.js';
import { runExplain } from '../src/commands/explain.js';
import { runInit } from '../src/commands/init.js';
import { runReset } from '../src/commands/reset.js';
import { runSearch } from '../src/commands/search.js';
import { runStatus } from '../src/commands/status.js';
import { runUpdate } from '../src/commands/update.js';
import { createConfigValidator } from '../src/config/config-validator.js';
import { runDoctorChecks } from '../src/diagnostics/doctor-checks.js';
import { isNeuronInitialized, neuronPaths } from '../src/services/neuron-fs.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeTemp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'neuron-cli-'));
  temps.push(dir);
  return dir;
}

async function writeFixture(
  root: string,
  kind: 'nextjs' | 'node' | 'empty',
): Promise<void> {
  if (kind === 'empty') return;

  if (kind === 'nextjs') {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'demo-next',
          dependencies: { next: '16.0.0', react: '19.0.0', pg: '8.0.0' },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(join(root, 'tsconfig.json'), '{}\n', 'utf8');
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n', 'utf8');
    await mkdir(join(root, 'apps'), { recursive: true });
    await mkdir(join(root, 'packages'), { recursive: true });
    return;
  }

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-node',
        dependencies: { express: '4.0.0' },
      },
      null,
      2,
    ),
    'utf8',
  );
}

describe('cli commands', () => {
  it('registers expected commands', () => {
    const cli = createCli();
    const names = cli.commands.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'init',
        'init cursor',
        'status',
        'explain',
        'analyze',
        'scan',
        'update',
        'reset',
        'project-report',
        'watch',
        'optimize-context',
        'benchmark',
        'benchmark report',
        'benchmark retrieval',
        'search',
        'suggest',
        'export',
        'doctor',
        'cursor setup',
        'cursor init',
        'cursor doctor',
        'constitution suggest',
        'constitution accept',
        'constitution health',
        'mcp',
      ]),
    );
  });

  it('init nextjs fixture creates .neuron and memories', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'nextjs');

    await runInit(root);

    expect(await isNeuronInitialized(root)).toBe(true);
    const paths = neuronPaths(root);
    const config = JSON.parse(await readFile(paths.config, 'utf8')) as {
      project: { name: string };
      integrations: { cursor: boolean };
    };
    expect(config.project.name).toBe('demo-next');
    expect(config.integrations.cursor).toBe(true);
    expect(config.privacy?.telemetry).toBe(false);
    expect(config.privacy?.localOnly).toBe(true);
    expect(config.scan?.ignore?.length).toBeGreaterThan(0);

    const store = JSON.parse(await readFile(paths.store, 'utf8')) as {
      memories: unknown[];
    };
    expect(store.memories.length).toBeGreaterThan(0);

    const mcp = JSON.parse(await readFile(join(root, '.cursor', 'mcp.json'), 'utf8')) as {
      mcpServers: { neuron: unknown };
    };
    expect(mcp.mcpServers.neuron).toBeTruthy();
  });

  it('init node fixture works', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'node');
    await runInit(root);
    expect(await isNeuronInitialized(root)).toBe(true);
  });

  it('init empty folder still initializes', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'empty');
    await runInit(root, { skipAnalyze: false });
    expect(await isNeuronInitialized(root)).toBe(true);
  });

  it('status and doctor run after init', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'node');
    await runInit(root);

    await runStatus(root);
    process.exitCode = 0;
    await runDoctor(root);
    expect(process.exitCode === 0 || process.exitCode === undefined).toBe(true);
  });

  it('search finds seeded memories', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'nextjs');
    await runInit(root);
    await runSearch('Next.js', root);
  });

  it('cursor setup writes commands and validates mcp', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'node');
    await runInit(root);

    const { runCursorSetup } = await import('../src/commands/cursor-setup.js');
    const { runCursorDoctor } = await import('../src/commands/cursor-doctor.js');
    await runCursorSetup(root, { force: true });

    const cmd = await readFile(
      join(root, '.cursor', 'commands', 'neuron-context.md'),
      'utf8',
    );
    expect(cmd).toMatch(/neuron_prepare_task/);

    const brain = await readFile(join(root, '.neuron', 'architecture.md'), 'utf8');
    expect(brain).toMatch(/Architecture/);

    process.exitCode = 0;
    await runCursorDoctor(root);
    expect(process.exitCode === 0 || process.exitCode === undefined).toBe(true);
  });

  it('explain and doctor checks after init', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'nextjs');
    await runInit(root);

    await runExplain(root);
    const checks = await runDoctorChecks(root);
    expect(checks.some((c) => c.name === 'Node version' && c.ok)).toBe(true);
    expect(checks.some((c) => c.name === 'Privacy mode' && c.ok)).toBe(true);
    expect(checks.some((c) => c.name.includes('MCP') && c.ok)).toBe(true);
  });

  it('update migrates metadata without failing', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'node');
    await runInit(root, { skipAnalyze: true });
    await runUpdate(root, { knowledge: false });
    expect(await isNeuronInitialized(root)).toBe(true);
  });

  it('reset --force removes .neuron', async () => {
    const root = await makeTemp();
    await writeFixture(root, 'node');
    await runInit(root, { skipAnalyze: true });
    expect(await isNeuronInitialized(root)).toBe(true);
    await runReset(root, { force: true });
    expect(await isNeuronInitialized(root)).toBe(false);
  });

  it('ConfigValidator catches invalid settings', () => {
    const result = createConfigValidator().validate({
      project: { id: '', name: 'x' },
      memory: { autoSave: false, threshold: 0.5 },
      integrations: { cursor: true, claudeCode: false, vscode: false },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

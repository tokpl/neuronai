import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createNeuronRuntime, type NeuronRuntime } from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function newProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-runtime-'));
  temps.push(root);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    'utf8',
  );
  return root;
}

async function seed(runtime: NeuronRuntime): Promise<void> {
  await runtime.engine.createMemory({
    projectId: runtime.project.projectId,
    type: 'architecture_decision',
    title: 'Rate limiting belongs in MCP middleware',
    content:
      'Apply rate limiting once in the MCP server middleware so every tool handler inherits it.',
    source: 'manual',
  });
  await runtime.engine.createMemory({
    projectId: runtime.project.projectId,
    type: 'architecture_decision',
    title: 'AGPL-3.0 licensing for first-party NeuronAI',
    content: 'The project ships under AGPL-3.0 with a separate trademark policy.',
    source: 'manual',
  });
  await runtime.engine.createMemory({
    projectId: runtime.project.projectId,
    type: 'pattern',
    title: 'Authentication uses JWT middleware',
    content: 'Auth runs as JWT middleware in the request pipeline, never inline in handlers.',
    source: 'manual',
  });
}

describe('NeuronRuntime (single construction path)', () => {
  it('builds a working brain, engine and retrieval from an empty project', async () => {
    const runtime = await createNeuronRuntime({ cwd: await newProject() });

    expect(runtime.project.name).toBe('demo-app');
    expect(runtime.listMemories()).toHaveLength(0);
    expect(runtime.search('anything')).toHaveLength(0);
  });

  it('persists memories and reloads them in a fresh runtime', async () => {
    const cwd = await newProject();
    const first = await createNeuronRuntime({ cwd });
    await seed(first);

    const second = await createNeuronRuntime({ cwd });
    expect(second.listMemories()).toHaveLength(3);
    expect(second.search('rate limiting')[0]?.doc.title).toContain('Rate limiting');
  });

  it('ranks by task relevance, not by importance', async () => {
    const runtime = await createNeuronRuntime({ cwd: await newProject() });
    await seed(runtime);

    const titles = runtime
      .search('add rate limiting to the MCP server tool handlers')
      .map((h) => h.doc.title);

    expect(titles[0]).toContain('Rate limiting');
    expect(titles.join(' ')).not.toContain('AGPL');
  });

  it('compiles context through the one shared path and respects the budget', async () => {
    const runtime = await createNeuronRuntime({ cwd: await newProject() });
    await seed(runtime);

    const prepared = runtime.context({ task: 'add rate limiting to the MCP server tool handlers' });

    expect(prepared.context).toContain('Rate limiting');
    expect(prepared.context).not.toContain('AGPL');
    expect(prepared.metrics.compiledTokens).toBeLessThanOrEqual(500);
    expect(prepared.metrics.candidates).toBe(3);
  });

  it('writes the brain atomically and leaves no temp files', async () => {
    const cwd = await newProject();
    const runtime = await createNeuronRuntime({ cwd });
    await seed(runtime);

    const knowledge = JSON.parse(await readFile(runtime.brain.paths.knowledge, 'utf8')) as {
      decisions: unknown[];
    };
    expect(knowledge.decisions).toHaveLength(2);
    await expect(readFile(`${runtime.brain.paths.knowledge}.tmp`, 'utf8')).rejects.toThrow();
  });

  it('does not create the retired goals and active planes', async () => {
    const runtime = await createNeuronRuntime({ cwd: await newProject() });
    const brainDir = runtime.brain.paths.brainDir;

    await expect(readFile(join(brainDir, 'goals.json'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(brainDir, 'active.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects an exact duplicate at the engine boundary', async () => {
    const runtime = await createNeuronRuntime({ cwd: await newProject() });
    const memory = {
      projectId: runtime.project.projectId,
      type: 'architecture_decision',
      title: 'Use RBAC with hierarchy',
      content: 'Problem: scalable permissions. Decision: RBAC with a role hierarchy.',
      source: 'manual' as const,
    };

    await runtime.engine.createMemory(memory);
    await expect(runtime.engine.createMemory(memory)).rejects.toThrow(/duplicate/i);
    expect(runtime.brain.knowledge.decisions).toHaveLength(1);
  });

  it('collapses reworded duplicates into one brain decision', async () => {
    const runtime = await createNeuronRuntime({ cwd: await newProject() });
    const base = {
      projectId: runtime.project.projectId,
      type: 'architecture_decision',
      title: 'Use RBAC with hierarchy',
      source: 'manual' as const,
    };

    // Same knowledge, three different wordings — the engine accepts all three.
    await runtime.engine.createMemory({
      ...base,
      content: 'Problem: scalable permissions. Decision: RBAC with a role hierarchy.',
    });
    await runtime.engine.createMemory({ ...base, content: 'Decision: RBAC, with a hierarchy.' });
    await runtime.engine.createMemory({ ...base, content: 'RBAC with hierarchy it is.' });

    expect(runtime.listMemories()).toHaveLength(3);
    // The curated brain keeps one, and says how many it merged.
    expect(runtime.brain.knowledge.decisions).toHaveLength(1);
    expect(runtime.lastDuplicatesRemoved).toBe(2);
    // The richest wording survives.
    expect(runtime.brain.knowledge.decisions[0]?.content).toContain('scalable permissions');
  });
});

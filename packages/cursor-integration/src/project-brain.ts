import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ProjectBrainInput {
  projectId: string;
  projectName: string;
  stack?: string[];
  architectureNotes?: string[];
  decisions?: Array<{ title: string; content: string }>;
  patterns?: Array<{ title: string; content: string }>;
  warnings?: Array<{ title: string; content: string }>;
}

export interface ProjectBrainPaths {
  config: string;
  brain: string;
  knowledge: string;
  decisions: string;
  rules: string;
  graph: string;
}

export function projectBrainPaths(neuronDir: string): ProjectBrainPaths {
  return {
    config: join(neuronDir, 'config.json'),
    brain: join(neuronDir, 'brain.json'),
    knowledge: join(neuronDir, 'knowledge.json'),
    decisions: join(neuronDir, 'decisions.json'),
    rules: join(neuronDir, 'rules.json'),
    graph: join(neuronDir, 'graph.json'),
  };
}

export async function writeProjectBrainFiles(
  neuronDir: string,
  input: ProjectBrainInput,
): Promise<ProjectBrainPaths> {
  const paths = projectBrainPaths(neuronDir);
  const now = new Date().toISOString();
  await mkdir(neuronDir, { recursive: true });
  await mkdir(join(neuronDir, 'cache'), { recursive: true });
  await mkdir(join(neuronDir, 'runtime'), { recursive: true });
  await mkdir(join(neuronDir, 'indexes'), { recursive: true });
  await mkdir(join(neuronDir, 'logs'), { recursive: true });

  if (!(await exists(paths.config))) {
    await writeFile(
      paths.config,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          project: {
            id: input.projectId,
            name: input.projectName,
            stack: input.stack ?? [],
          },
          privacy: { mode: 'suggest', localOnly: true, telemetry: false },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  await writeFile(
    paths.brain,
    `${JSON.stringify(
      {
        version: 1,
        projectId: input.projectId,
        name: input.projectName,
        stack: input.stack ?? [],
        summary: input.architectureNotes?.join(' ') || undefined,
        updatedAt: now,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await writeFile(
    paths.decisions,
    `${JSON.stringify(
      {
        version: 1,
        decisions: (input.decisions ?? []).map((d, i) => ({
          id: `decision-${i}`,
          title: d.title,
          content: d.content,
        })),
        updatedAt: now,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await writeFile(
    paths.knowledge,
    `${JSON.stringify(
      {
        version: 1,
        patterns: (input.patterns ?? []).map((p, i) => ({
          id: `pattern-${i}`,
          title: p.title,
          content: p.content,
        })),
        warnings: (input.warnings ?? []).map((w, i) => ({
          id: `warning-${i}`,
          title: w.title,
          content: w.content,
        })),
        facts: [],
        other: [],
        updatedAt: now,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await writeFile(
    paths.rules,
    `${JSON.stringify({ version: 1, rules: [], updatedAt: now }, null, 2)}\n`,
    'utf8',
  );

  await writeFile(
    paths.graph,
    `${JSON.stringify({ version: 1, nodes: [], edges: [], updatedAt: now }, null, 2)}\n`,
    'utf8',
  );

  return paths;
}

async function exists(path: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function templatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'templates');
}

export async function readPackagedTemplate(...parts: string[]): Promise<string> {
  const path = join(templatesRoot(), ...parts);
  return readFile(path, 'utf8');
}

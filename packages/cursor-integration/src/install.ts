import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeNeuronMcpConfig, validateCursorMcpConfig } from './mcp-config.js';

export interface CursorInstallResult {
  mcpPath: string;
  rulesPath: string;
  skillPath: string;
  commandsDir: string;
  cursorDetected: boolean;
  mcpValid: boolean;
  mcpErrors: string[];
  mcpWarnings: string[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function templateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'templates'),
    join(here, '..', 'templates'),
    join(here, '..', '..', 'templates'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[1]!;
}

async function loadTemplate(...parts: string[]): Promise<string> {
  return readFile(join(templateDir(), ...parts), 'utf8');
}

export async function installCursorIntegration(
  projectRoot: string,
  options: { force?: boolean } = {},
): Promise<CursorInstallResult> {
  const cursorDir = join(projectRoot, '.cursor');
  const rulesDir = join(cursorDir, 'rules');
  const skillsDir = join(cursorDir, 'skills', 'neuron-memory');
  const commandsDir = join(cursorDir, 'commands');

  const cursorDetected = await pathExists(cursorDir);

  await mkdir(rulesDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(commandsDir, { recursive: true });

  const mcpPath = join(cursorDir, 'mcp.json');
  const rulesPath = join(rulesDir, 'neuron-memory.mdc');
  const skillPath = join(skillsDir, 'SKILL.md');

  let existing: unknown = {};
  if (await pathExists(mcpPath)) {
    try {
      existing = JSON.parse(await readFile(mcpPath, 'utf8')) as unknown;
    } catch {
      existing = {};
    }
  }

  const merged = mergeNeuronMcpConfig(existing, projectRoot);
  await writeFile(mcpPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  const validation = validateCursorMcpConfig(merged);

  if (!(await pathExists(rulesPath)) || options.force) {
    await writeFile(rulesPath, await loadTemplate('rules', 'neuron-memory.mdc'), 'utf8');
  }
  if (!(await pathExists(skillPath)) || options.force) {
    await writeFile(skillPath, await loadTemplate('skills', 'neuron-memory', 'SKILL.md'), 'utf8');
  }

  const commandFiles = [
    'neuron-context.md',
    'neuron-plan.md',
    'neuron-review.md',
    'neuron-save.md',
    'neuron-explain.md',
    'architect.md',
    'review.md',
    'debug.md',
    'security.md',
    'performance.md',
    'docs.md',
    'refactor.md',
  ];
  for (const file of commandFiles) {
    const dest = join(commandsDir, file);
    if (!(await pathExists(dest)) || options.force) {
      await writeFile(dest, await loadTemplate('commands', file), 'utf8');
    }
  }

  return {
    mcpPath,
    rulesPath,
    skillPath,
    commandsDir,
    cursorDetected,
    mcpValid: validation.ok,
    mcpErrors: validation.errors,
    mcpWarnings: validation.warnings,
  };
}

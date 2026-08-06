import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeNeuronMcpConfig, validateCursorMcpConfig } from './mcp-config.js';

/** Retired MCP tool names that mean generated Cursor guidance is out of date. */
const LEGACY_MARKERS = [
  'neuron_prepare_task',
  'neuron_get_context',
  'neuron_search_memory',
  'neuron_scan_project',
  'neuron_store_memory',
  'neuron_save_decision',
  'neuron_project_summary',
] as const;

/** Phrase that must appear once P0 anti-rediscovery guidance shipped. */
const REQUIRED_GUIDANCE = 'Before broad repository exploration';

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

  // Always refresh agent guidance when it still names retired tools — otherwise
  // an upgrade leaves Cursor calling neuron_prepare_task against a 7-tool server.
  const refreshGuidance = async (dest: string, templateParts: string[]): Promise<void> => {
    const missing = !(await pathExists(dest));
    let stale = false;
    if (!missing) {
      const body = await readFile(dest, 'utf8');
      stale =
        LEGACY_MARKERS.some((m) => body.includes(m)) ||
        (templateParts.includes('neuron-memory.mdc') && !body.includes(REQUIRED_GUIDANCE));
    }
    if (missing || options.force || stale) {
      await writeFile(dest, await loadTemplate(...templateParts), 'utf8');
    }
  };

  await refreshGuidance(rulesPath, ['rules', 'neuron-memory.mdc']);
  await refreshGuidance(skillPath, ['skills', 'neuron-memory', 'SKILL.md']);

  const commandFiles = ['neuron-context.md', 'neuron-save.md', 'neuron-explain.md'];
  for (const file of commandFiles) {
    await refreshGuidance(join(commandsDir, file), ['commands', file]);
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

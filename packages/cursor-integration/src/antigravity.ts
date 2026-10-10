import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  buildNeuronMcpEntry,
  mergeNeuronMcpConfig,
  validateCursorMcpConfig,
} from './mcp-config.js';

/** Retired MCP tool names that mean generated guidance is out of date. */
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

/** Antigravity always-on rules require this frontmatter key. */
const REQUIRED_TRIGGER = 'trigger: always_on';

const AGENTS_START = '<!-- neuron-memory:start -->';
const AGENTS_END = '<!-- neuron-memory:end -->';

export interface AntigravityInstallResult {
  workspaceMcpPath: string;
  globalMcpPath: string;
  rulesPath: string;
  skillPath: string;
  agentsMdPath: string;
  mcpConfigured: boolean;
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

function isGuidanceStale(body: string): boolean {
  return (
    LEGACY_MARKERS.some((m) => body.includes(m)) ||
    !body.includes(REQUIRED_GUIDANCE) ||
    !body.includes(REQUIRED_TRIGGER)
  );
}

function upsertAgentsBlock(existing: string, block: string): string {
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END);
  const normalized = block.trimEnd() + '\n';

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + AGENTS_END.length);
    return `${before}${normalized}${after.replace(/^\r?\n/, '')}`;
  }

  if (!existing.trim()) {
    return normalized;
  }

  const sep = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing.trimEnd()}${sep}${normalized}`;
}

/**
 * Ensure global Antigravity MCP has a neuron entry.
 * When workspace MCP is written, do not overwrite an existing NEURON_CWD path.
 */
export function mergeGlobalAntigravityMcp(
  existing: unknown,
  projectRoot: string,
  options: { workspaceConfigured: boolean },
): { mcpServers: Record<string, unknown> } {
  let servers: Record<string, unknown> = {};
  if (existing && typeof existing === 'object' && 'mcpServers' in existing) {
    const mcp = (existing as { mcpServers?: Record<string, unknown> }).mcpServers;
    if (mcp && typeof mcp === 'object') servers = { ...mcp };
  }

  const current = servers['neuron'];
  if (!current || typeof current !== 'object') {
    servers['neuron'] = buildNeuronMcpEntry(projectRoot);
    return { mcpServers: servers };
  }

  const entry = { ...(current as Record<string, unknown>) };
  const env =
    entry['env'] && typeof entry['env'] === 'object'
      ? { ...(entry['env'] as Record<string, string>) }
      : {};

  const existingCwd = env['NEURON_CWD'];
  const legacyRoot = env['NEURON_PROJECT_ROOT'];

  if (existingCwd && options.workspaceConfigured) {
    // Keep global cwd pointing at whatever project it already had.
    delete env['NEURON_PROJECT_ROOT'];
    entry['env'] = env;
    if (!entry['command'] || !Array.isArray(entry['args'])) {
      const built = buildNeuronMcpEntry(existingCwd);
      entry['command'] = entry['command'] ?? built.command;
      entry['args'] = entry['args'] ?? built.args;
    }
    servers['neuron'] = entry;
    return { mcpServers: servers };
  }

  const cwd = existingCwd || legacyRoot || projectRoot;
  const built = buildNeuronMcpEntry(cwd);
  servers['neuron'] = {
    command: typeof entry['command'] === 'string' ? entry['command'] : built.command,
    args: Array.isArray(entry['args']) ? entry['args'] : built.args,
    env: {
      ...env,
      NEURON_CWD: cwd,
    },
  };
  const neuronEnv = (servers['neuron'] as { env: Record<string, string> }).env;
  delete neuronEnv['NEURON_PROJECT_ROOT'];

  return { mcpServers: servers };
}

export async function installAntigravityIntegration(
  projectRoot: string,
  options: { force?: boolean } = {},
): Promise<AntigravityInstallResult> {
  const agentsDir = join(projectRoot, '.agents');
  const rulesDir = join(agentsDir, 'rules');
  const skillsDir = join(agentsDir, 'skills', 'neuron-memory');

  await mkdir(rulesDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });

  const workspaceMcpPath = join(agentsDir, 'mcp_config.json');
  const rulesPath = join(rulesDir, 'neuron-memory.md');
  const skillPath = join(skillsDir, 'SKILL.md');
  const agentsMdPath = join(projectRoot, 'AGENTS.md');

  // 1. Workspace MCP (primary for multi-project)
  let existingWorkspace: unknown = {};
  if (await pathExists(workspaceMcpPath)) {
    try {
      existingWorkspace = JSON.parse(await readFile(workspaceMcpPath, 'utf8')) as unknown;
    } catch {
      existingWorkspace = {};
    }
  }
  const workspaceMerged = mergeNeuronMcpConfig(existingWorkspace, projectRoot);
  await writeFile(workspaceMcpPath, `${JSON.stringify(workspaceMerged, null, 2)}\n`, 'utf8');
  const workspaceValidation = validateCursorMcpConfig(workspaceMerged);

  // 2. Global MCP fallback
  const geminiConfigDir = join(homedir(), '.gemini', 'config');
  const globalMcpPath = join(geminiConfigDir, 'mcp_config.json');
  await mkdir(geminiConfigDir, { recursive: true });

  let existingGlobal: unknown = { mcpServers: {} };
  if (await pathExists(globalMcpPath)) {
    try {
      existingGlobal = JSON.parse(await readFile(globalMcpPath, 'utf8')) as unknown;
    } catch {
      existingGlobal = { mcpServers: {} };
    }
  }
  const globalMerged = mergeGlobalAntigravityMcp(existingGlobal, projectRoot, {
    workspaceConfigured: true,
  });
  await writeFile(globalMcpPath, `${JSON.stringify(globalMerged, null, 2)}\n`, 'utf8');

  const mcpConfigured = workspaceValidation.ok;
  const mcpErrors = workspaceValidation.errors;
  const mcpWarnings = [
    ...workspaceValidation.warnings,
    'Prefer workspace .agents/mcp_config.json; global ~/.gemini/config/mcp_config.json is fallback.',
  ];

  // 3. Rules + skill
  const refreshGuidance = async (
    dest: string,
    templateParts: string[],
    staleCheck: (body: string) => boolean,
  ): Promise<void> => {
    const missing = !(await pathExists(dest));
    let stale = false;
    if (!missing) {
      stale = staleCheck(await readFile(dest, 'utf8'));
    }
    if (missing || options.force || stale) {
      await writeFile(dest, await loadTemplate(...templateParts), 'utf8');
    }
  };

  await refreshGuidance(
    rulesPath,
    ['antigravity', 'rules', 'neuron-memory.md'],
    (body) => isGuidanceStale(body) || !body.includes('trigger: always_on'),
  );
  await refreshGuidance(skillPath, ['antigravity', 'skills', 'neuron-memory', 'SKILL.md'], (body) =>
    LEGACY_MARKERS.some((m) => body.includes(m)),
  );

  // 4. AGENTS.md marked block
  const block = await loadTemplate('antigravity', 'AGENTS.neuron-block.md');
  let agentsBody = '';
  if (await pathExists(agentsMdPath)) {
    agentsBody = await readFile(agentsMdPath, 'utf8');
  }
  const needsAgents =
    options.force ||
    !agentsBody.includes(AGENTS_START) ||
    !agentsBody.includes(AGENTS_END) ||
    !agentsBody.includes('neuron_context');
  if (needsAgents) {
    await writeFile(agentsMdPath, upsertAgentsBlock(agentsBody, block), 'utf8');
  }

  return {
    workspaceMcpPath,
    globalMcpPath,
    rulesPath,
    skillPath,
    agentsMdPath,
    mcpConfigured,
    mcpErrors,
    mcpWarnings,
  };
}

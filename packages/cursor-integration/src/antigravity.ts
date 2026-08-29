import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

/** Phrase that must appear once P0 anti-rediscovery guidance shipped. */
const REQUIRED_GUIDANCE = 'Before broad repository exploration';

export interface AntigravityInstallResult {
  mcpConfigPath: string;
  rulesPath: string;
  skillPath: string;
  mcpConfigured: boolean;
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
    join(here, '..', 'templates'),
    join(here, '..', '..', 'templates'),
    join(here, '..', '..', '..', 'templates'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

async function loadTemplate(...parts: string[]): Promise<string> {
  return readFile(join(templateDir(), ...parts), 'utf8');
}

export async function installAntigravityIntegration(
  projectRoot: string,
  options: { force?: boolean } = {},
): Promise<AntigravityInstallResult> {
  // 1. Configure MCP server in ~/.gemini/config/mcp_config.json
  const geminiConfigDir = join(homedir(), '.gemini', 'config');
  const mcpConfigPath = join(geminiConfigDir, 'mcp_config.json');

  await mkdir(geminiConfigDir, { recursive: true });

  let mcpConfigured = false;
  let mcpConfig: Record<string, unknown> = { mcpServers: {} };

  if (await pathExists(mcpConfigPath)) {
    try {
      const content = await readFile(mcpConfigPath, 'utf8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        mcpConfig = parsed;
      }
      if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
        mcpConfig.mcpServers = {};
      }
    } catch {
      // JSON parse error or similar, just overwrite
    }
  }

  // Define the Neuron MCP server block for Antigravity
  (mcpConfig.mcpServers as Record<string, unknown>).neuron = {
    command: 'npx',
    args: ['-y', 'neuronai', 'mcp'],
    env: {
      NEURON_PROJECT_ROOT: projectRoot,
    },
  };

  await writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf8');
  mcpConfigured = true;

  // 2. Configure Rules and Skills in .agents folder
  const antigravityDir = join(projectRoot, '.agents');
  const rulesDir = join(antigravityDir, 'rules');
  const skillsDir = join(antigravityDir, 'skills', 'neuron-memory');

  await mkdir(rulesDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });

  const rulesPath = join(rulesDir, 'neuron-memory.md');
  const skillPath = join(skillsDir, 'SKILL.md');

  const refreshGuidance = async (dest: string, templateParts: string[]): Promise<void> => {
    const missing = !(await pathExists(dest));
    let stale = false;
    if (!missing) {
      const body = await readFile(dest, 'utf8');
      stale = (templateParts.includes('neuron-memory.mdc') && !body.includes(REQUIRED_GUIDANCE));
    }
    if (missing || options.force || stale) {
      const content = await loadTemplate(...templateParts);
      await writeFile(dest, content, 'utf8');
    }
  };

  // We reuse the Cursor templates but change the extension or path mapping.
  // Note: the original template is `neuron-memory.mdc`, we copy it to `.md` for Antigravity.
  await refreshGuidance(rulesPath, ['rules', 'neuron-memory.mdc']);
  await refreshGuidance(skillPath, ['skills', 'neuron-memory', 'SKILL.md']);

  return {
    mcpConfigPath,
    rulesPath,
    skillPath,
    mcpConfigured,
  };
}

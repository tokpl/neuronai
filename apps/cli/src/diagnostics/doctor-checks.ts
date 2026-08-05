import { access, constants, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createConfigValidator } from '../config/config-validator.js';
import { CLI_VERSION, isNeuronInitialized, neuronPaths, pathExists } from '../services/neuron-fs.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

function nodeMajor(): number {
  const m = /^v(\d+)/.exec(process.version);
  return m ? Number(m[1]) : 0;
}

export async function runDoctorChecks(cwd = process.cwd()): Promise<DoctorCheck[]> {
  const paths = neuronPaths(cwd);
  const checks: DoctorCheck[] = [];
  const major = nodeMajor();

  checks.push({
    name: 'Node version',
    ok: major >= 22,
    detail: `${process.version} (require >= 22)`,
    fix: 'Install Node.js 22+',
  });

  checks.push({
    name: 'CLI version',
    ok: true,
    detail: CLI_VERSION,
  });

  try {
    await access(cwd, constants.R_OK | constants.W_OK);
    checks.push({
      name: 'Permissions',
      ok: true,
      detail: 'Project directory readable + writable',
    });
  } catch {
    checks.push({
      name: 'Permissions',
      ok: false,
      detail: `Cannot read/write ${cwd}`,
      fix: 'Fix directory permissions',
    });
  }

  const initialized = await isNeuronInitialized(cwd);
  checks.push({
    name: 'Initialized',
    ok: initialized,
    detail: initialized ? paths.neuronDir : 'Missing .neuron/config.json',
    fix: 'neuron init',
  });

  if (initialized) {
    try {
      const raw = JSON.parse(await readFile(paths.config, 'utf8')) as unknown;
      const validator = createConfigValidator();
      const result = validator.validate(raw, cwd);
      const pathIssues = result.config
        ? await validator.validatePaths(cwd, result.config)
        : [];
      const allIssues = [...result.issues, ...pathIssues];
      const errors = allIssues.filter((i) => i.severity === 'error');
      checks.push({
        name: 'Config valid',
        ok: errors.length === 0,
        detail:
          errors.length === 0
            ? allIssues.length
              ? `OK (${allIssues.length} warning(s))`
              : paths.config
            : errors.map((e) => `${e.path}: ${e.message}`).join('; '),
        fix: 'neuron init --force',
      });

      if (result.config) {
        checks.push({
          name: 'Privacy mode',
          ok: result.config.privacy.localOnly !== false && result.config.privacy.telemetry !== true,
          detail: `localOnly=${result.config.privacy.localOnly !== false}, telemetry=${result.config.privacy.telemetry === true ? 'ON' : 'OFF'}`,
          fix: 'Set privacy.telemetry=false and privacy.localOnly=true in .neuron/config.json',
        });
      }
    } catch (error) {
      checks.push({
        name: 'Config valid',
        ok: false,
        detail: String(error),
        fix: 'neuron init --force',
      });
    }
  }

  const hasLocalStore = await pathExists(paths.store);
  const hasNeuronDir = await pathExists(paths.neuronDir);
  checks.push({
    name: 'Storage',
    ok: hasLocalStore || hasNeuronDir || initialized,
    detail: hasLocalStore
      ? 'Local FileStorageProvider (.neuron/runtime/store.json)'
      : initialized
        ? 'Local mode ready (store created on first write)'
        : 'Not initialized - run neuron init',
    fix: 'neuron init (local filesystem - no database required)',
  });

  const hasEnvExample = await pathExists(join(paths.root, '.env.example'));
  const hasEnv = await pathExists(join(paths.root, '.env'));
  checks.push({
    name: 'Dependencies / env',
    ok: true,
    detail: hasEnv
      ? '.env present'
      : hasEnvExample
        ? '.env optional (.env.example present)'
        : 'local mode (no .env required)',
  });

  const mcpPath = join(paths.root, '.cursor', 'mcp.json');
  let mcpOk = false;
  let mcpDetail = 'Missing .cursor/mcp.json';
  if (await pathExists(mcpPath)) {
    try {
      const mcp = JSON.parse(await readFile(mcpPath, 'utf8')) as {
        mcpServers?: Record<string, unknown>;
      };
      mcpOk = Boolean(mcp.mcpServers?.['neuron']);
      mcpDetail = mcpOk ? 'neuron MCP entry found' : 'mcp.json exists but neuron server missing';
    } catch {
      mcpDetail = 'mcp.json is not valid JSON';
    }
  }
  checks.push({
    name: 'Cursor integration / MCP',
    ok: mcpOk,
    detail: mcpDetail,
    fix: 'neuron cursor setup',
  });

  const neuronRule = join(paths.root, '.cursor', 'rules', 'neuron-memory.mdc');
  const neuronRuleAlt = join(paths.root, '.cursor', 'rules', 'neuron.mdc');
  const hasRule = (await pathExists(neuronRule)) || (await pathExists(neuronRuleAlt));
  checks.push({
    name: 'Cursor rules',
    ok: hasRule || !initialized,
    detail: hasRule
      ? 'Neuron Cursor rule present'
      : initialized
        ? 'Missing .cursor/rules/neuron*.mdc'
        : 'Skipped (not initialized)',
    fix: 'neuron cursor setup --force',
  });

  if (initialized) {
    try {
      const { openProjectSession } = await import('../services/project-session.js');
      const { loadMetadata } = await import('../services/neuron-fs.js');
      const meta = await loadMetadata(cwd);
      const session = await openProjectSession(cwd);
      const memories = session.listMemories();
      const corrupt = memories.filter((m) => !m.id || !m.title || !m.content);
      checks.push({
        name: 'Memories',
        ok: corrupt.length === 0,
        detail:
          corrupt.length === 0
            ? `${memories.length} records (meta count ${meta.memoryCount})`
            : `${corrupt.length} corrupted records`,
        fix: corrupt.length ? 'Inspect .neuron/runtime/store.json' : undefined,
      });
    } catch (error) {
      checks.push({
        name: 'Memories',
        ok: false,
        detail: String(error),
        fix: 'Delete .neuron/runtime/store.json and run neuron scan',
      });
    }
  }

  checks.push({
    name: 'CLI binary',
    ok: true,
    detail: process.argv[1] ?? 'neuron',
  });

  return checks;
}

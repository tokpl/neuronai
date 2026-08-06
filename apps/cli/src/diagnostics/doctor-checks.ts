import { access, constants, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createConfigValidator } from '../config/config-validator.js';
import {
  CLI_VERSION,
  isNeuronInitialized,
  neuronPaths,
  pathExists,
} from '../services/neuron-fs.js';

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
    detail: initialized ? paths.neuronDir : 'Missing .neuron/prefs.json',
    fix: 'neuron init',
  });

  if (initialized) {
    try {
      const { openProjectBrain } = await import('@neuronai/brain');
      const brain = await openProjectBrain(cwd);
      const raw = brain.prefs as unknown;
      const validator = createConfigValidator();
      const result = validator.validate(raw, cwd);
      const pathIssues = result.config ? await validator.validatePaths(cwd, result.config) : [];
      const allIssues = [...result.issues, ...pathIssues];
      const errors = allIssues.filter((i) => i.severity === 'error');
      checks.push({
        name: 'Prefs valid',
        ok: errors.length === 0 && Boolean(brain.prefs),
        detail:
          errors.length === 0
            ? allIssues.length
              ? `OK (${allIssues.length} warning(s))`
              : paths.prefs
            : errors.map((e) => `${e.path}: ${e.message}`).join('; '),
        fix: 'neuron init --force',
      });

      const s = brain.status();
      checks.push({
        name: 'Project Brain',
        ok: s.dnaUpdated || s.knowledgeUpdated || s.healthPercent >= 0,
        detail: `health ${s.healthPercent}% · ${s.memoryCount} memories · ${s.decisionCount} decisions`,
        fix: 'neuron scan',
      });

      if (result.config) {
        checks.push({
          name: 'Privacy mode',
          ok: result.config.privacy.localOnly !== false && result.config.privacy.telemetry !== true,
          detail: `localOnly=${result.config.privacy.localOnly !== false}, telemetry=${result.config.privacy.telemetry === true ? 'ON' : 'OFF'}`,
          fix: 'Set privacy.telemetry=false and privacy.localOnly=true in .neuron/prefs.json',
        });
      }
    } catch (error) {
      checks.push({
        name: 'Prefs valid',
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
      ? 'Local files under .neuron/ (no database)'
      : initialized
        ? 'Local mode ready (store created on first write)'
        : 'Not initialized - run neuron init',
    fix: 'neuron init',
  });

  if (initialized) {
    checks.push(await checkFreshness(cwd));
  }

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
  let ruleLegacy = false;
  if (await pathExists(neuronRule)) {
    const body = await readFile(neuronRule, 'utf8');
    ruleLegacy = /neuron_prepare_task|neuron_get_context|neuron_search_memory/.test(body);
  }
  checks.push({
    name: 'Cursor rules',
    ok: (hasRule && !ruleLegacy) || !initialized,
    detail: ruleLegacy
      ? 'neuron-memory.mdc still names retired MCP tools — Cursor will call tools that do not exist'
      : hasRule
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

  if (initialized) {
    checks.push(await checkRetrieval(cwd));
    checks.push(await checkProjectMap(cwd));
    checks.push(await checkContextBudget(cwd));
    checks.push(await checkStaleMapPaths(cwd));
    checks.push(await checkStaleScanKnowledge(cwd));
  }

  return checks;
}

const STALE_AFTER_DAYS = 14;

/** A brain that has not been re-scanned drifts away from the code. */
async function checkFreshness(cwd: string): Promise<DoctorCheck> {
  const { loadMetadata } = await import('../services/neuron-fs.js');
  const meta = await loadMetadata(cwd);
  const last = meta.lastAnalyzeAt ?? meta.initializedAt;
  const at = last ? new Date(last).getTime() : Number.NaN;

  if (Number.isNaN(at)) {
    return {
      name: 'Brain freshness',
      ok: false,
      detail: 'Never scanned',
      fix: 'neuron scan',
    };
  }

  const days = Math.floor((Date.now() - at) / 86_400_000);
  const age = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  return {
    name: 'Brain freshness',
    ok: days < STALE_AFTER_DAYS,
    detail:
      days < STALE_AFTER_DAYS
        ? `Last learned from the codebase ${age}`
        : `Brain knowledge is stale. Last scan: ${age}.`,
    fix: days < STALE_AFTER_DAYS ? undefined : 'neuron scan',
  };
}

/**
 * End-to-end probe: a brain that stores memories but cannot retrieve them looks
 * healthy on every other check. This is the failure that shipped in the MVP.
 */
async function checkRetrieval(cwd: string): Promise<DoctorCheck> {
  try {
    const { openProjectSession } = await import('../services/project-session.js');
    const session = await openProjectSession(cwd);
    const memories = session.listMemories();

    if (memories.length === 0) {
      return {
        name: 'Retrieval',
        ok: false,
        detail: 'The brain is empty, so there is nothing to retrieve',
        fix: 'neuron scan',
      };
    }

    // Query using a real memory's own title: it must find itself.
    const probe = memories[0]!;
    const hits = session.search(probe.title, 5);
    const found = hits.some((h) => h.doc.id === probe.id);

    // A known project fact (module or stack) should also be retrievable.
    const module = session.brain.dna.structure.modules?.value?.[0];
    const factQuery = module ?? session.brain.dna.platforms.data?.value ?? 'project';
    const factHits = session.search(String(factQuery), 5);
    const factOk = factHits.length > 0;

    return {
      name: 'Retrieval',
      ok: found && factOk,
      detail:
        found && factOk
          ? `Working (${memories.length} memories; project fact "${factQuery}" retrievable)`
          : found
            ? 'Memories searchable, but a basic project fact returned nothing'
            : 'Stored memories are not searchable',
      fix: found && factOk ? undefined : 'neuron scan (rebuilds the brain from the codebase)',
    };
  } catch (error) {
    return {
      name: 'Retrieval',
      ok: false,
      detail: error instanceof Error ? error.message : 'Retrieval failed to run',
      fix: 'neuron reset --force && neuron init',
    };
  }
}

async function checkProjectMap(cwd: string): Promise<DoctorCheck> {
  try {
    const { openProjectSession } = await import('../services/project-session.js');
    const session = await openProjectSession(cwd);
    const entries = session.brain.getMap().entries;
    const nested = entries.filter((e) => e.path.includes('/'));

    return {
      name: 'Project map',
      ok: entries.length > 0,
      detail:
        entries.length === 0
          ? 'No location map — AI must rediscover the tree every time'
          : `${entries.length} locations${nested.length ? ` (${nested.length} nested paths)` : ''}`,
      fix: entries.length ? undefined : 'neuron scan',
    };
  } catch (error) {
    return {
      name: 'Project map',
      ok: false,
      detail: error instanceof Error ? error.message : 'Map check failed',
      fix: 'neuron scan',
    };
  }
}

async function checkContextBudget(cwd: string): Promise<DoctorCheck> {
  try {
    const { openProjectSession } = await import('../services/project-session.js');
    const session = await openProjectSession(cwd);
    const prepared = session.context({
      task: 'Where are the main modules and API routes in this project?',
    });
    const tokens = prepared.efficiency.contextTokens;
    const budget = prepared.efficiency.budgetTokens;
    const ok = tokens <= budget;

    return {
      name: 'Context budget',
      ok,
      detail: ok
        ? `${tokens} / ${budget} tokens · ~${prepared.efficiency.estimatedTokensSaved} avoided vs whole brain`
        : `Context exceeded budget (${tokens} > ${budget})`,
      fix: ok ? undefined : 'Report a bug — the compiler should never exceed its budget',
    };
  } catch (error) {
    return {
      name: 'Context budget',
      ok: false,
      detail: error instanceof Error ? error.message : 'Context probe failed',
      fix: 'neuron scan',
    };
  }
}

async function checkStaleMapPaths(cwd: string): Promise<DoctorCheck> {
  try {
    const { access } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { openProjectSession } = await import('../services/project-session.js');
    const session = await openProjectSession(cwd);
    const entries = session.brain.getMap().entries;
    if (entries.length === 0) {
      return {
        name: 'Stale paths',
        ok: true,
        detail: 'No map entries to validate',
      };
    }

    let missing = 0;
    for (const entry of entries.slice(0, 80)) {
      const relative = entry.path.replace(/[/\\]+$/, '');
      try {
        await access(join(cwd, relative));
      } catch {
        missing += 1;
      }
    }

    const ratio = missing / Math.min(entries.length, 80);
    const ok = ratio < 0.25;

    return {
      name: 'Stale paths',
      ok,
      detail: ok
        ? missing === 0
          ? 'All sampled map paths exist on disk'
          : `${missing} missing of ${Math.min(entries.length, 80)} sampled (within tolerance)`
        : `${missing} map paths no longer exist — knowledge is stale`,
      fix: ok ? undefined : 'neuron scan',
    };
  } catch (error) {
    return {
      name: 'Stale paths',
      ok: false,
      detail: error instanceof Error ? error.message : 'Stale-path check failed',
      fix: 'neuron scan',
    };
  }
}

async function checkStaleScanKnowledge(cwd: string): Promise<DoctorCheck> {
  try {
    const { access } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { isScanDerived, isUserAuthored, normalizeEvidencePath } = await import(
      '@neuronai/storage'
    );
    const { openProjectSession } = await import('../services/project-session.js');
    const session = await openProjectSession(cwd);

    const pathAlive = async (raw: string): Promise<boolean> => {
      const p = normalizeEvidencePath(raw);
      if (!p) return false;
      try {
        await access(join(cwd, p));
        return true;
      } catch {
        /* try as directory prefix */
      }
      try {
        await access(join(cwd, p.replace(/\/$/, '')));
        return true;
      } catch {
        return false;
      }
    };

    let staleCount = 0;
    for (const memory of session.listMemories()) {
      if (isUserAuthored(memory) || !isScanDerived(memory)) continue;
      if (!memory.paths?.length) continue;
      const lives = await Promise.all(memory.paths.map((p) => pathAlive(p)));
      if (lives.every((ok) => !ok)) staleCount += 1;
    }

    return {
      name: 'Scan knowledge',
      ok: staleCount === 0,
      detail:
        staleCount === 0
          ? 'Scan-derived facts match current paths'
          : `${staleCount} scan fact(s) still point at deleted paths`,
      fix: staleCount ? 'neuron scan --update' : undefined,
    };
  } catch (error) {
    return {
      name: 'Scan knowledge',
      ok: false,
      detail: error instanceof Error ? error.message : 'Scan-knowledge check failed',
      fix: 'neuron scan',
    };
  }
}

import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateCursorMcpConfig } from './mcp-config.js';

/** Tool names retired when MCP collapsed to the 7-tool Project Brain surface. */
const LEGACY_TOOL_MARKERS = [
  'neuron_prepare_task',
  'neuron_get_context',
  'neuron_search_memory',
  'neuron_scan_project',
  'neuron_store_memory',
  'neuron_save_decision',
  'neuron_project_summary',
] as const;

const EXPECTED_TOOLS = [
  'neuron_context',
  'neuron_search',
  'neuron_remember',
  'neuron_update',
  'neuron_after_task',
  'neuron_resolve_suggestion',
  'neuron_scan',
] as const;

export interface CursorDoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
  /** When true, this check failing means Cursor must reload MCP — not a config rewrite. */
  reloadRequired?: boolean;
}

export interface CursorDoctorReport {
  checks: CursorDoctorCheck[];
  ok: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn the configured MCP binary and list tools (same entry Cursor uses).
 * Returns null when the process cannot be probed.
 */
async function probeMcpToolCatalog(
  command: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ tools: string[]; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ tools: [], error: 'MCP probe timed out' });
    }, 8_000);

    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ tools: [], error: String(error) });
    });

    const send = (msg: object) => {
      child.stdin.write(`${JSON.stringify(msg)}\n`);
    };

    setTimeout(() => {
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'neuron-cursor-doctor', version: '0.0.0' },
        },
      });
    }, 50);

    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    }, 200);

    setTimeout(() => {
      clearTimeout(timer);
      child.kill();
      try {
        const lines = out
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const msg = JSON.parse(line) as {
            id?: number;
            result?: { tools?: Array<{ name: string }> };
          };
          if (msg.id === 2 && msg.result?.tools) {
            resolve({ tools: msg.result.tools.map((t) => t.name).sort() });
            return;
          }
        }
        resolve({
          tools: [],
          error: err.trim() || 'tools/list response not found',
        });
      } catch (error) {
        resolve({ tools: [], error: String(error) });
      }
    }, 1_500);
  });
}

/**
 * Cursor-focused diagnostics (MCP, rules, skills, commands, brain files).
 */
export async function runCursorDoctorChecks(projectRoot: string): Promise<CursorDoctorReport> {
  const checks: CursorDoctorCheck[] = [];
  const cursorDir = join(projectRoot, '.cursor');
  const neuronDir = join(projectRoot, '.neuron');

  const cursorExists = await exists(cursorDir);
  checks.push({
    name: 'Cursor project folder',
    ok: cursorExists,
    detail: cursorExists ? cursorDir : 'Missing .cursor/ - run neuron cursor setup',
    fix: 'neuron cursor setup',
  });

  let mcpCommand: string | undefined;
  let mcpArgs: string[] = [];
  let mcpEnv: Record<string, string> = {};

  const mcpPath = join(cursorDir, 'mcp.json');
  if (await exists(mcpPath)) {
    try {
      const raw = JSON.parse(await readFile(mcpPath, 'utf8')) as unknown;
      const v = validateCursorMcpConfig(raw);
      checks.push({
        name: 'MCP configuration',
        ok: v.ok,
        detail: v.ok
          ? `neuron → ${v.neuron?.command} ${(v.neuron?.args ?? []).join(' ')}`
          : v.errors.join('; '),
        fix: 'neuron cursor setup --force',
      });
      if (v.ok && v.neuron) {
        mcpCommand = v.neuron.command;
        mcpArgs = v.neuron.args ?? [];
        mcpEnv = (v.neuron.env as Record<string, string> | undefined) ?? {};
      }
      for (const w of v.warnings) {
        checks.push({
          name: 'MCP warning',
          ok: true,
          detail: w,
        });
      }
    } catch (error) {
      checks.push({
        name: 'MCP configuration',
        ok: false,
        detail: String(error),
        fix: 'neuron cursor setup --force',
      });
    }
  } else {
    checks.push({
      name: 'MCP configuration',
      ok: false,
      detail: 'Missing .cursor/mcp.json',
      fix: 'neuron cursor setup',
    });
  }

  const rulesPath = join(cursorDir, 'rules', 'neuron-memory.mdc');
  const rulesExist = await exists(rulesPath);
  let rulesLegacy = false;
  if (rulesExist) {
    const body = await readFile(rulesPath, 'utf8');
    rulesLegacy = LEGACY_TOOL_MARKERS.some((m) => body.includes(m));
  }
  checks.push({
    name: 'Neuron rules',
    ok: rulesExist && !rulesLegacy,
    detail: !rulesExist
      ? 'Missing neuron-memory.mdc'
      : rulesLegacy
        ? 'neuron-memory.mdc still names retired MCP tools (neuron_prepare_task / neuron_get_context)'
        : rulesPath,
    fix: 'neuron cursor setup --force',
  });

  const skillPath = join(cursorDir, 'skills', 'neuron-memory', 'SKILL.md');
  const skillExist = await exists(skillPath);
  let skillLegacy = false;
  if (skillExist) {
    const body = await readFile(skillPath, 'utf8');
    skillLegacy = LEGACY_TOOL_MARKERS.some((m) => body.includes(m));
  }
  checks.push({
    name: 'Neuron skill',
    ok: skillExist && !skillLegacy,
    detail: !skillExist
      ? 'Missing skills/neuron-memory/SKILL.md'
      : skillLegacy
        ? 'Skill still names retired MCP tools'
        : skillPath,
    fix: 'neuron cursor setup --force',
  });

  const commands = ['neuron-context.md', 'neuron-save.md', 'neuron-explain.md'];
  let cmdOk = 0;
  let cmdLegacy = false;
  for (const c of commands) {
    const p = join(cursorDir, 'commands', c);
    if (!(await exists(p))) continue;
    cmdOk += 1;
    const body = await readFile(p, 'utf8');
    if (LEGACY_TOOL_MARKERS.some((m) => body.includes(m))) cmdLegacy = true;
  }
  checks.push({
    name: 'Cursor commands',
    ok: cmdOk === commands.length && !cmdLegacy,
    detail: cmdLegacy
      ? 'Command prompts still name retired MCP tools'
      : `${cmdOk}/${commands.length} command prompts installed`,
    fix: 'neuron cursor setup --force',
  });

  const brainFiles = ['brain/dna.json', 'brain/knowledge.json', 'brain/health.json', 'prefs.json'];
  let brainOk = 0;
  for (const f of brainFiles) {
    if (await exists(join(neuronDir, f))) brainOk += 1;
  }

  let brainStatus = `${brainOk}/${brainFiles.length} files`;
  let brainRetrievalOk = brainOk === brainFiles.length;
  try {
    const { openProjectBrain } = await import('@neuronai/brain');
    const brain = await openProjectBrain(projectRoot);
    const s = brain.status();
    brainStatus =
      brainOk === brainFiles.length
        ? `READY · health ${s.healthPercent}% · knowledge ${s.memoryCount}`
        : `${brainOk}/${brainFiles.length} brain files - run neuron init`;
    brainRetrievalOk = brainOk === brainFiles.length && s.dnaUpdated;
  } catch {
    brainRetrievalOk = false;
  }

  checks.push({
    name: 'Brain retrieval',
    ok: brainRetrievalOk,
    detail: brainStatus,
    fix: 'neuron init && neuron scan',
  });

  if (mcpCommand) {
    const probe = await probeMcpToolCatalog(mcpCommand, mcpArgs, mcpEnv);
    if (probe.error && probe.tools.length === 0) {
      checks.push({
        name: 'Tool catalog',
        ok: false,
        detail: `Could not probe MCP binary: ${probe.error}`,
        fix: 'neuron cursor setup --force',
      });
    } else {
      const missing = EXPECTED_TOOLS.filter((t) => !probe.tools.includes(t));
      const legacy = probe.tools.filter((t) =>
        (LEGACY_TOOL_MARKERS as readonly string[]).includes(t),
      );
      const catalogOk = missing.length === 0 && legacy.length === 0;
      checks.push({
        name: 'Tool catalog',
        ok: catalogOk,
        detail: catalogOk
          ? `READY · ${EXPECTED_TOOLS.length} tools (${probe.tools.join(', ')})`
          : legacy.length
            ? `RELOAD REQUIRED · binary still exposes legacy tools: ${legacy.join(', ')}`
            : `RELOAD REQUIRED · missing ${missing.join(', ')}. Configured binary is current after setup; reload Cursor MCP.`,
        fix: catalogOk
          ? undefined
          : 'Toggle neuron off/on in Cursor Settings → Tools & MCP (or reload window)',
        reloadRequired: !catalogOk,
      });
    }
  } else {
    checks.push({
      name: 'Tool catalog',
      ok: false,
      detail: 'RELOAD REQUIRED · no MCP command to probe',
      fix: 'neuron cursor setup --force',
      reloadRequired: true,
    });
  }

  checks.push({
    name: 'Cursor enable step',
    ok: true,
    detail:
      'After setup/upgrade: Settings → Tools & MCP → toggle "neuron" off then on (or Reload Window)',
  });

  const ok = checks.every((c) => c.ok);
  return { checks, ok };
}

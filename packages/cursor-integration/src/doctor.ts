import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateCursorMcpConfig, type NeuronMcpEntry } from './mcp-config.js';

/** Tool names retired when MCP collapsed to the product Project Brain surface. */
export const LEGACY_TOOL_MARKERS = [
  'neuron_prepare_task',
  'neuron_get_context',
  'neuron_search_memory',
  'neuron_scan_project',
  'neuron_store_memory',
  'neuron_save_decision',
  'neuron_project_summary',
] as const;

export const EXPECTED_MCP_TOOLS = [
  'neuron_context',
  'neuron_search',
  'neuron_remember',
  'neuron_update',
  'neuron_after_task',
  'neuron_resolve_suggestion',
  'neuron_resolve_clarify',
  'neuron_workflow',
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

/** Observable MCP status for CLI / reports — does not invent IDE-private state. */
export type IdeCatalogState = 'MANUAL_CHECK_REQUIRED' | 'PASS' | 'STALE' | 'UNKNOWN';

export interface NeuronMcpStatus {
  configured: 'PASS' | 'FAIL';
  configuredDetail: string;
  freshStdio: 'PASS' | 'FAIL';
  freshStdioDetail: string;
  toolCount: number | null;
  tools: string[];
  neuronContext: 'PASS' | 'FAIL';
  neuronContextDetail: string;
  ideCatalog: IdeCatalogState;
  ideCatalogDetail: string;
  action: 'OK' | 'RELOAD_REQUIRED' | 'FIX_CONFIG' | 'FIX_BINARY';
  actionDetail: string;
}

export interface CursorDoctorReport {
  checks: CursorDoctorCheck[];
  ok: boolean;
  mcpStatus: NeuronMcpStatus;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface McpProbeResult {
  tools: string[];
  error?: string;
  neuronContextOk?: boolean;
  neuronContextPreview?: string;
  neuronContextError?: string;
}

/**
 * Spawn the configured MCP binary (same entry Cursor uses): initialize → tools/list
 * → optional tools/call neuron_context.
 */
export async function probeConfiguredMcp(
  command: string,
  args: string[],
  env: Record<string, string>,
  options: { callContext?: boolean; contextTask?: string } = {},
): Promise<McpProbeResult> {
  const callContext = options.callContext ?? true;
  const contextTask = options.contextTask ?? 'Where is the payment implementation?';

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    let settled = false;
    const finish = (result: McpProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        tools: [],
        error: err.trim()
          ? `MCP probe timed out: ${err.trim().slice(0, 200)}`
          : 'MCP probe timed out',
      });
    }, 12_000);

    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
      tryParse();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      finish({ tools: [], error: String(error) });
    });

    const send = (msg: object) => {
      child.stdin.write(`${JSON.stringify(msg)}\n`);
    };

    let tools: string[] = [];
    let listed = false;
    let contextDone = !callContext;

    const tryParse = () => {
      const lines = out
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        let msg: {
          id?: number;
          result?: {
            tools?: Array<{ name: string }>;
            content?: Array<{ type: string; text?: string }>;
          };
          error?: { code?: number; message?: string };
        };
        try {
          msg = JSON.parse(line) as typeof msg;
        } catch {
          continue;
        }
        if (msg.id === 2 && msg.result?.tools && !listed) {
          listed = true;
          tools = msg.result.tools.map((t) => t.name).sort();
          if (callContext && tools.includes('neuron_context')) {
            send({
              jsonrpc: '2.0',
              id: 3,
              method: 'tools/call',
              params: {
                name: 'neuron_context',
                arguments: { task: contextTask },
              },
            });
          } else if (callContext) {
            contextDone = true;
            finish({
              tools,
              neuronContextOk: false,
              neuronContextError: 'neuron_context not in tools/list',
            });
          } else {
            finish({ tools });
          }
        }
        if (msg.id === 3) {
          contextDone = true;
          if (msg.error) {
            finish({
              tools,
              neuronContextOk: false,
              neuronContextError: msg.error.message ?? JSON.stringify(msg.error),
            });
            return;
          }
          const text =
            msg.result?.content?.find((c) => c.type === 'text')?.text ??
            JSON.stringify(msg.result ?? {});
          finish({
            tools,
            neuronContextOk: text.length > 10 && !/-32602|Tool not found/i.test(text),
            neuronContextPreview: text.slice(0, 240),
          });
        }
      }
      if (listed && contextDone && !settled && !callContext) {
        finish({ tools });
      }
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
  });
}

function buildMcpStatus(input: {
  neuron?: NeuronMcpEntry;
  configOk: boolean;
  configDetail: string;
  probe?: McpProbeResult;
}): NeuronMcpStatus {
  const configured = input.configOk ? 'PASS' : 'FAIL';
  const probe = input.probe;
  const tools = probe?.tools ?? [];
  const freshOk = Boolean(probe && !probe.error && tools.length > 0);
  const missing = EXPECTED_MCP_TOOLS.filter((t) => !tools.includes(t));
  const legacy = tools.filter((t) => (LEGACY_TOOL_MARKERS as readonly string[]).includes(t));
  const contextOk = Boolean(probe?.neuronContextOk);

  let action: NeuronMcpStatus['action'] = 'RELOAD_REQUIRED';
  let actionDetail =
    'STALE CATALOG FIX: Cursor Settings → Tools & MCP → neuron OFF → wait → ON (or Developer: Reload Window). Confirm tool count matches EXPECTED_MCP_TOOLS (includes neuron_context, neuron_resolve_clarify, neuron_workflow). -32602 on legacy names = stale IDE catalog, not a Brain bug.';
  if (!input.configOk) {
    action = 'FIX_CONFIG';
    actionDetail = 'Run: neuron cursor setup --force';
  } else if (!freshOk || legacy.length > 0 || missing.length > 0 || !contextOk) {
    action = 'FIX_BINARY';
    actionDetail =
      'Rebuild/reinstall neuronai, then: neuron cursor setup --force && neuron cursor doctor';
  }

  return {
    configured,
    configuredDetail: input.configDetail,
    freshStdio: freshOk ? 'PASS' : 'FAIL',
    freshStdioDetail: probe?.error
      ? probe.error
      : freshOk
        ? `handshake + tools/list ok (${tools.length} tools)`
        : 'no tools/list from configured process',
    toolCount: freshOk ? tools.length : null,
    tools,
    neuronContext: contextOk ? 'PASS' : 'FAIL',
    neuronContextDetail: contextOk
      ? 'tools/call neuron_context succeeded on fresh stdio process'
      : (probe?.neuronContextError ??
        (freshOk ? 'neuron_context missing or call failed' : 'skipped — stdio probe failed')),
    ideCatalog: 'MANUAL_CHECK_REQUIRED',
    ideCatalogDetail:
      'CLI cannot read Cursor’s private in-memory tools/list. Manual: Settings → Tools & MCP → neuron → confirm exactly 9 tools (includes neuron_resolve_clarify + neuron_workflow), neuron_context present, no neuron_prepare_task / neuron_get_context. If CallMcpTool returns -32602 against legacy names while stdio is PASS → stale IDE catalog (RELOAD).',
    action,
    actionDetail,
  };
}

/**
 * Format the observable Neuron MCP block for CLI output.
 */
export function formatNeuronMcpStatus(status: NeuronMcpStatus): string {
  const lines = [
    'Neuron MCP',
    `  Configured: ${status.configured}`,
    `  Fresh stdio process: ${status.freshStdio}`,
    `  Tool catalog: ${status.toolCount == null ? 'n/a' : `${status.toolCount} tools`}`,
    `  neuron_context: ${status.neuronContext}`,
    `  IDE catalog: ${status.ideCatalog === 'MANUAL_CHECK_REQUIRED' ? 'MANUAL CHECK REQUIRED' : status.ideCatalog}`,
    `  Action: ${status.action.replace(/_/g, ' ')}`,
  ];
  return lines.join('\n');
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
  let configOk = false;
  let configDetail = 'Missing .cursor/mcp.json';
  let neuronEntry: NeuronMcpEntry | undefined;

  const mcpPath = join(cursorDir, 'mcp.json');
  if (await exists(mcpPath)) {
    try {
      const raw = JSON.parse(await readFile(mcpPath, 'utf8')) as unknown;
      const v = validateCursorMcpConfig(raw);
      configOk = v.ok;
      configDetail = v.ok
        ? `neuron → ${v.neuron?.command} ${(v.neuron?.args ?? []).join(' ')}`
        : v.errors.join('; ');
      checks.push({
        name: 'MCP configuration',
        ok: v.ok,
        detail: configDetail,
        fix: 'neuron cursor setup --force',
      });
      if (v.ok && v.neuron) {
        neuronEntry = v.neuron;
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
      configOk = false;
      configDetail = String(error);
      checks.push({
        name: 'MCP configuration',
        ok: false,
        detail: configDetail,
        fix: 'neuron cursor setup --force',
      });
    }
  } else {
    checks.push({
      name: 'MCP configuration',
      ok: false,
      detail: configDetail,
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

  const workflowSkills = ['neuron-memory', 'neuron-deliver'] as const;
  let skillOk = 0;
  let skillLegacy = false;
  for (const name of workflowSkills) {
    const skillPath = join(cursorDir, 'skills', name, 'SKILL.md');
    if (!(await exists(skillPath))) continue;
    skillOk += 1;
    const body = await readFile(skillPath, 'utf8');
    if (LEGACY_TOOL_MARKERS.some((m) => body.includes(m))) skillLegacy = true;
  }
  checks.push({
    name: 'Neuron skills',
    ok: skillOk === workflowSkills.length && !skillLegacy,
    detail: skillLegacy
      ? 'A skill still names retired MCP tools'
      : skillOk === workflowSkills.length
        ? `${skillOk}/${workflowSkills.length} skills (memory + deliver)`
        : `Missing skills (${skillOk}/${workflowSkills.length})`,
    fix: 'neuron cursor setup --force',
  });

  const workflowRules = ['neuron-deliver.mdc'] as const;
  let workflowRulesOk = 0;
  for (const name of workflowRules) {
    if (await exists(join(cursorDir, 'rules', name))) workflowRulesOk += 1;
  }
  checks.push({
    name: 'Neuron workflow rules',
    ok: workflowRulesOk === workflowRules.length,
    detail:
      workflowRulesOk === workflowRules.length
        ? 'neuron-deliver.mdc'
        : `Missing neuron-deliver.mdc`,
    fix: 'neuron cursor setup --force',
  });

  const commands = [
    'neuron-context.md',
    'neuron-save.md',
    'neuron-explain.md',
    'neuron-deliver.md',
  ];
  let cmdOk = 0;
  let cmdLegacy = false;

  const commandPromises = commands.map(async (c) => {
    const p = join(cursorDir, 'commands', c);
    if (!(await exists(p))) return { exists: false, legacy: false };
    const body = await readFile(p, 'utf8');
    const legacy = LEGACY_TOOL_MARKERS.some((m) => body.includes(m));
    return { exists: true, legacy };
  });

  const commandResults = await Promise.all(commandPromises);
  for (const r of commandResults) {
    if (r.exists) cmdOk += 1;
    if (r.legacy) cmdLegacy = true;
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
  let primedOk = false;
  let primedDetail = 'Not primed — run neuron init (or neuron prime refresh)';
  let decayDetail = 'n/a';
  let gateOk = true;
  let gateDetail = 'No open deliver gate';
  let deliverDetail = 'No deliver history yet';
  let boardOk = true;
  let boardDetail = 'No active deliver board';
  try {
    const {
      openProjectBrain,
      isPrimed,
      findStaleMemories,
      readDeliverGate,
      isGateActive,
      readDeliverHistory,
      readWorkflowBoard,
    } = await import('@neuronai/brain');
    const brain = await openProjectBrain(projectRoot);
    const s = brain.status();
    brainStatus =
      brainOk === brainFiles.length
        ? `READY · health ${s.healthPercent}% · knowledge ${s.memoryCount}`
        : `${brainOk}/${brainFiles.length} brain files - run neuron init`;
    brainRetrievalOk = brainOk === brainFiles.length && s.dnaUpdated;
    primedOk = isPrimed(brain);
    primedDetail = primedOk
      ? `${brain.paths.projectMap} · prefs.workflow.primedAt`
      : 'Missing PROJECT_MAP.md or prefs.workflow.primedAt';
    const stale = findStaleMemories(brain);
    decayDetail =
      stale.length === 0
        ? 'No stale file refs in memories'
        : `${stale.length} memories reference missing files (review / neuron_update)`;

    const gate = await readDeliverGate(brain);
    gateOk = !isGateActive(gate);
    gateDetail = gateOk
      ? 'No open deliver gate'
      : `Open gate — ${gate!.questionIds.filter((id) => !gate!.answeredIds.includes(id)).length} clarify left (${gate!.reason})`;

    const board = await readWorkflowBoard(brain);
    if (board && board.phase !== 'completed' && board.status === 'active') {
      boardOk = true; // advisory incomplete
      boardDetail = `Active deliver · phase ${board.phase} · ${board.waves.filter((w) => w.status === 'done').length}/${board.waves.length} waves`;
    } else if (board?.phase === 'completed') {
      boardDetail = `Last board completed · remembered=${Boolean(board.remembered)}`;
    }

    const history = await readDeliverHistory(brain, 20);
    if (history.length) {
      const remembered = history.filter((h) => h.remembered).length;
      const express = history.filter((h) => h.express).length;
      deliverDetail = `Last ${history.length} delivers · remembered ${remembered}/${history.length} · express ${express}/${history.length}`;
    }
  } catch {
    brainRetrievalOk = false;
    decayDetail = 'Could not scan for decay';
  }

  checks.push({
    name: 'Brain retrieval',
    ok: brainRetrievalOk,
    detail: brainStatus,
    fix: 'neuron init && neuron scan',
  });

  checks.push({
    name: 'Neuron primed',
    ok: primedOk,
    detail: primedDetail,
    fix: 'neuron prime',
  });

  const hooksJson = join(cursorDir, 'hooks.json');
  const gateHook = join(cursorDir, 'hooks', 'neuron-gate.mjs');
  let hooksOk = false;
  let hooksDetail = 'Missing neuron-gate hook';
  if (await exists(hooksJson) && (await exists(gateHook))) {
    try {
      const hj = await readFile(hooksJson, 'utf8');
      hooksOk = hj.includes('neuron-gate');
      hooksDetail = hooksOk
        ? 'preToolUse neuron-gate.mjs (blocks Write while gate open)'
        : 'hooks.json present but neuron-gate not wired';
    } catch {
      hooksOk = false;
    }
  }
  checks.push({
    name: 'Deliver gate hook',
    ok: hooksOk,
    detail: hooksDetail,
    fix: 'neuron cursor setup --force',
  });

  checks.push({
    name: 'Open deliver gate',
    ok: gateOk,
    detail: gateDetail,
    fix: 'neuron_resolve_clarify until gate clears (or clear .neuron/workflow/gate.json after answers)',
  });

  const lastDeliverPath = join(neuronDir, 'workflow', 'LAST_DELIVER.md');
  const lastDeliverOk = await exists(lastDeliverPath);
  checks.push({
    name: 'Last deliver receipt',
    ok: true,
    detail: lastDeliverOk
      ? 'LAST_DELIVER.md present (team-visible)'
      : 'No LAST_DELIVER.md yet — appears after a completed remembered deliver',
    fix: 'Finish /neuron-deliver with neuron_after_task + remembered',
  });

  checks.push({
    name: 'Deliver board',
    ok: boardOk,
    detail: boardDetail,
    fix: '/neuron-deliver or neuron_workflow get_board',
  });

  checks.push({
    name: 'Deliver history',
    ok: true, // advisory
    detail: deliverDetail,
    fix: 'Complete delivers with neuron_after_task + remembered',
  });

  checks.push({
    name: 'Memory decay',
    ok: true, // advisory
    detail: decayDetail,
    fix: 'neuron_update or remove stale memories',
  });

  let probe: McpProbeResult | undefined;
  if (mcpCommand) {
    probe = await probeConfiguredMcp(mcpCommand, mcpArgs, mcpEnv, { callContext: true });
    if (probe.error && probe.tools.length === 0) {
      checks.push({
        name: 'Fresh stdio process',
        ok: false,
        detail: `Could not probe MCP binary: ${probe.error}`,
        fix: 'neuron cursor setup --force',
      });
      checks.push({
        name: 'Tool catalog (stdio)',
        ok: false,
        detail: 'n/a — stdio probe failed',
        fix: 'pnpm build && neuron cursor setup --force',
      });
      checks.push({
        name: 'neuron_context (stdio)',
        ok: false,
        detail: 'n/a — stdio probe failed',
      });
    } else {
      const missing = EXPECTED_MCP_TOOLS.filter((t) => !probe!.tools.includes(t));
      const legacy = probe.tools.filter((t) =>
        (LEGACY_TOOL_MARKERS as readonly string[]).includes(t),
      );
      const catalogOk =
        missing.length === 0 &&
        legacy.length === 0 &&
        probe.tools.length === EXPECTED_MCP_TOOLS.length;
      checks.push({
        name: 'Fresh stdio process',
        ok: true,
        detail: `PASS · initialize + tools/list (${probe.tools.length} tools)`,
      });
      checks.push({
        name: 'Tool catalog (stdio)',
        ok: catalogOk,
        detail: catalogOk
          ? `PASS · ${EXPECTED_MCP_TOOLS.length} tools (${probe.tools.join(', ')})`
          : legacy.length
            ? `FAIL · binary still exposes legacy tools: ${legacy.join(', ')}`
            : `FAIL · missing ${missing.join(', ')} (got ${probe.tools.join(', ') || 'none'})`,
        fix: catalogOk ? undefined : 'pnpm build && neuron cursor setup --force',
      });
      checks.push({
        name: 'neuron_context (stdio)',
        ok: Boolean(probe.neuronContextOk),
        detail: probe.neuronContextOk
          ? 'PASS · tools/call succeeded on fresh process'
          : `FAIL · ${probe.neuronContextError ?? 'call failed'}`,
        fix: probe.neuronContextOk ? undefined : 'pnpm build && neuron cursor doctor',
      });
    }
  } else {
    checks.push({
      name: 'Fresh stdio process',
      ok: false,
      detail: 'FAIL · no MCP command to probe',
      fix: 'neuron cursor setup --force',
    });
  }

  checks.push({
    name: 'IDE catalog',
    ok: true,
    detail:
      'MANUAL CHECK REQUIRED · CLI cannot read Cursor’s private tools/list. After reload: exactly 9 neuron tools (incl. neuron_resolve_clarify, neuron_workflow), neuron_context visible, no neuron_prepare_task. -32602 on legacy names = stale IDE catalog.',
    fix: 'Cursor Settings → Tools & MCP → neuron OFF → ON (or Developer: Reload Window)',
    reloadRequired: true,
  });

  const mcpStatus = buildMcpStatus({
    neuron: neuronEntry,
    configOk,
    configDetail,
    probe,
  });

  // Config/stdio failures fail the report; IDE manual gate stays ok:true (not inventing STALE).
  const ok = checks.every((c) => c.ok);
  return { checks, ok, mcpStatus };
}

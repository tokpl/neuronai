import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

import {
  EXPECTED_MCP_TOOLS,
  LEGACY_TOOL_MARKERS,
  formatNeuronMcpStatus,
  probeConfiguredMcp,
  type CursorDoctorCheck,
  type NeuronMcpStatus,
} from './doctor.js';
import { validateCursorMcpConfig, type NeuronMcpEntry } from './mcp-config.js';

export interface AntigravityDoctorReport {
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

function buildAntigravityMcpStatus(input: {
  neuron?: NeuronMcpEntry;
  configOk: boolean;
  configDetail: string;
  probe?: Awaited<ReturnType<typeof probeConfiguredMcp>>;
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
    'CLI cannot inspect Antigravity’s in-memory catalog. Refresh MCP Servers, then Allow mcp(neuron/*) if tools stay in Ask mode.';
  if (!input.configOk) {
    action = 'FIX_CONFIG';
    actionDetail = 'Run: neuron antigravity setup --force';
  } else if (!freshOk || legacy.length > 0 || missing.length > 0 || !contextOk) {
    action = 'FIX_BINARY';
    actionDetail =
      'Rebuild/reinstall neuronai, then: neuron antigravity setup --force && neuron antigravity doctor';
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
      'CLI cannot read Antigravity’s private MCP catalog. Manual: Customizations → Installed MCP Servers → Refresh → confirm neuron tools, Allow mcp(neuron/*).',
    action,
    actionDetail,
  };
}

/**
 * Antigravity-focused diagnostics (workspace/global MCP, rules, skill, AGENTS.md).
 */
export async function runAntigravityDoctorChecks(
  projectRoot: string,
): Promise<AntigravityDoctorReport> {
  const checks: CursorDoctorCheck[] = [];
  const agentsDir = join(projectRoot, '.agents');
  const neuronDir = join(projectRoot, '.neuron');

  const agentsExists = await exists(agentsDir);
  checks.push({
    name: 'Antigravity project folder',
    ok: agentsExists,
    detail: agentsExists ? agentsDir : 'Missing .agents/ - run neuron antigravity setup',
    fix: 'neuron antigravity setup',
  });

  let configOk = false;
  let configDetail = 'Missing .agents/mcp_config.json';
  let neuronEntry: NeuronMcpEntry | undefined;
  let mcpCommand: string | undefined;
  let mcpArgs: string[] = [];
  let mcpEnv: Record<string, string> = {};

  const workspaceMcpPath = join(agentsDir, 'mcp_config.json');
  if (await exists(workspaceMcpPath)) {
    try {
      const raw = JSON.parse(await readFile(workspaceMcpPath, 'utf8')) as unknown;
      const v = validateCursorMcpConfig(raw);
      configOk = v.ok;
      configDetail = v.ok
        ? `workspace neuron → ${v.neuron?.command} ${(v.neuron?.args ?? []).join(' ')}`
        : v.errors.join('; ');
      checks.push({
        name: 'Workspace MCP configuration',
        ok: v.ok,
        detail: configDetail,
        fix: 'neuron antigravity setup --force',
      });
      if (v.ok && v.neuron) {
        neuronEntry = v.neuron;
        mcpCommand = v.neuron.command;
        mcpArgs = v.neuron.args ?? [];
        mcpEnv = (v.neuron.env as Record<string, string> | undefined) ?? {};
      }
      const cwd = v.neuron?.env?.['NEURON_CWD'];
      checks.push({
        name: 'NEURON_CWD on workspace MCP',
        ok: Boolean(cwd),
        detail: cwd ? `NEURON_CWD=${cwd}` : 'NEURON_CWD missing (legacy NEURON_PROJECT_ROOT will not work)',
        fix: 'neuron antigravity setup --force',
      });
      for (const w of v.warnings) {
        checks.push({ name: 'MCP warning', ok: true, detail: w });
      }
    } catch (error) {
      configOk = false;
      configDetail = String(error);
      checks.push({
        name: 'Workspace MCP configuration',
        ok: false,
        detail: configDetail,
        fix: 'neuron antigravity setup --force',
      });
    }
  } else {
    checks.push({
      name: 'Workspace MCP configuration',
      ok: false,
      detail: configDetail,
      fix: 'neuron antigravity setup',
    });
  }

  const globalMcpPath = join(homedir(), '.gemini', 'config', 'mcp_config.json');
  const globalExists = await exists(globalMcpPath);
  let globalHasNeuron = false;
  if (globalExists) {
    try {
      const raw = JSON.parse(await readFile(globalMcpPath, 'utf8')) as {
        mcpServers?: Record<string, unknown>;
      };
      globalHasNeuron = Boolean(raw.mcpServers?.['neuron']);
    } catch {
      globalHasNeuron = false;
    }
  }
  checks.push({
    name: 'Global MCP fallback',
    ok: globalExists && globalHasNeuron,
    detail:
      globalExists && globalHasNeuron
        ? globalMcpPath
        : 'Missing neuron in ~/.gemini/config/mcp_config.json (optional fallback)',
    fix: 'neuron antigravity setup --force',
  });

  const rulesPath = join(agentsDir, 'rules', 'neuron-memory.md');
  const rulesExist = await exists(rulesPath);
  let rulesOk = false;
  let rulesDetail = 'Missing neuron-memory.md';
  if (rulesExist) {
    const body = await readFile(rulesPath, 'utf8');
    const legacy = LEGACY_TOOL_MARKERS.some((m) => body.includes(m));
    const hasTrigger = /trigger:\s*always_on/.test(body);
    const hasGuidance = body.includes('Before broad repository exploration');
    rulesOk = !legacy && hasTrigger && hasGuidance;
    rulesDetail = !hasTrigger
      ? 'Rule missing trigger: always_on (Antigravity will discard it)'
      : legacy
        ? 'Rule still names retired MCP tools'
        : !hasGuidance
          ? 'Rule missing anti-rediscovery guidance'
          : rulesPath;
  }
  checks.push({
    name: 'Neuron rules',
    ok: rulesOk,
    detail: rulesDetail,
    fix: 'neuron antigravity setup --force',
  });

  const skillPath = join(agentsDir, 'skills', 'neuron-memory', 'SKILL.md');
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
    fix: 'neuron antigravity setup --force',
  });

  const agentsMdPath = join(projectRoot, 'AGENTS.md');
  const agentsMdExist = await exists(agentsMdPath);
  let agentsMdOk = false;
  if (agentsMdExist) {
    const body = await readFile(agentsMdPath, 'utf8');
    agentsMdOk =
      body.includes('<!-- neuron-memory:start -->') &&
      body.includes('<!-- neuron-memory:end -->') &&
      body.includes('neuron_context');
  }
  checks.push({
    name: 'AGENTS.md Neuron block',
    ok: agentsMdOk,
    detail: agentsMdOk
      ? agentsMdPath
      : 'Missing marked Neuron block in AGENTS.md',
    fix: 'neuron antigravity setup --force',
  });

  const knowledgePath = join(neuronDir, 'brain', 'knowledge.json');
  const prefsPath = join(neuronDir, 'prefs.json');
  const brainOk = (await exists(knowledgePath)) && (await exists(prefsPath));
  checks.push({
    name: 'Project Brain files',
    ok: brainOk,
    detail: brainOk
      ? '.neuron/brain/knowledge.json + prefs.json'
      : 'Missing brain files — run neuron init',
    fix: 'neuron init',
  });

  let probe: Awaited<ReturnType<typeof probeConfiguredMcp>> | undefined;
  if (configOk && mcpCommand) {
    probe = await probeConfiguredMcp(mcpCommand, mcpArgs, mcpEnv);
    const freshOk = !probe.error && probe.tools.length > 0;
    checks.push({
      name: 'MCP stdio probe',
      ok: freshOk && Boolean(probe.neuronContextOk),
      detail: probe.error
        ? probe.error
        : freshOk
          ? `${probe.tools.length} tools; neuron_context=${probe.neuronContextOk ? 'ok' : 'fail'}`
          : 'no tools listed',
      fix: 'neuron antigravity setup --force',
    });
  }

  const mcpStatus = buildAntigravityMcpStatus({
    neuron: neuronEntry,
    configOk,
    configDetail,
    probe,
  });

  // Soften: global fallback missing alone should not fail overall if workspace is healthy.
  const hardFails = checks.filter(
    (c) => !c.ok && c.name !== 'Global MCP fallback',
  );
  return {
    checks,
    ok: hardFails.length === 0,
    mcpStatus,
  };
}

export { formatNeuronMcpStatus };

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

/** Core only: memory loop + gated deliver. Prime is part of `neuron init`. */
const WORKFLOW_SKILLS = ['neuron-memory', 'neuron-deliver'] as const;
const WORKFLOW_RULES = ['neuron-memory.mdc', 'neuron-deliver.mdc'] as const;
const COMMAND_FILES = [
  'neuron-context.md',
  'neuron-save.md',
  'neuron-explain.md',
  'neuron-deliver.md',
] as const;

export async function installCursorIntegration(
  projectRoot: string,
  options: { force?: boolean } = {},
): Promise<CursorInstallResult> {
  const cursorDir = join(projectRoot, '.cursor');
  const rulesDir = join(cursorDir, 'rules');
  const commandsDir = join(cursorDir, 'commands');

  const cursorDetected = await pathExists(cursorDir);

  await mkdir(rulesDir, { recursive: true });
  await mkdir(commandsDir, { recursive: true });
  for (const skill of WORKFLOW_SKILLS) {
    await mkdir(join(cursorDir, 'skills', skill), { recursive: true });
  }

  const mcpPath = join(cursorDir, 'mcp.json');
  const rulesPath = join(rulesDir, 'neuron-memory.mdc');
  const skillPath = join(cursorDir, 'skills', 'neuron-memory', 'SKILL.md');

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
  // an upgrade leaves Cursor calling neuron_prepare_task against a stale product server.
  const refreshGuidance = async (dest: string, templateParts: string[]): Promise<void> => {
    const missing = !(await pathExists(dest));
    let stale = false;
    if (!missing) {
      const body = await readFile(dest, 'utf8');
      const isMemoryRule = templateParts.includes('neuron-memory.mdc');
      const isDeliverSkill =
        templateParts.includes('neuron-deliver') && templateParts.includes('SKILL.md');
      const isMemorySkill =
        templateParts.includes('neuron-memory') && templateParts.includes('SKILL.md');
      stale =
        LEGACY_MARKERS.some((m) => body.includes(m)) ||
        (isMemoryRule && !body.includes(REQUIRED_GUIDANCE)) ||
        (isMemoryRule && !body.includes('propose_waves')) ||
        (isDeliverSkill &&
          (!body.includes('complete_checklist') || !body.includes('best-effort'))) ||
        (isMemorySkill && !body.includes('neuron_workflow'));
    }
    if (missing || options.force || stale) {
      await writeFile(dest, await loadTemplate(...templateParts), 'utf8');
    }
  };

  for (const rule of WORKFLOW_RULES) {
    await refreshGuidance(join(rulesDir, rule), ['rules', rule]);
  }
  for (const skill of WORKFLOW_SKILLS) {
    await refreshGuidance(join(cursorDir, 'skills', skill, 'SKILL.md'), [
      'skills',
      skill,
      'SKILL.md',
    ]);
  }
  for (const file of COMMAND_FILES) {
    await refreshGuidance(join(commandsDir, file), ['commands', file]);
  }

  // Deliver gate hook — blocks Write while .neuron/workflow/gate.json is open
  const hooksDir = join(cursorDir, 'hooks');
  await mkdir(hooksDir, { recursive: true });
  await writeFile(
    join(hooksDir, 'neuron-gate.mjs'),
    await loadTemplate('hooks', 'neuron-gate.mjs'),
    'utf8',
  );
  const hooksJsonPath = join(cursorDir, 'hooks.json');
  const hooksTemplate = JSON.parse(await loadTemplate('hooks', 'hooks.json')) as {
    version: number;
    hooks: Record<string, Array<Record<string, unknown>>>;
  };
  const gateEntryFresh = (h: Record<string, unknown>): boolean => {
    const cmd = typeof h.command === 'string' ? h.command : '';
    if (!cmd.includes('neuron-gate')) return true;
    const matcher = typeof h.matcher === 'string' ? h.matcher : '';
    const want =
      typeof hooksTemplate.hooks.preToolUse?.[0]?.matcher === 'string'
        ? String(hooksTemplate.hooks.preToolUse[0].matcher)
        : 'Write|StrReplace|EditNotebook|Delete|ApplyPatch';
    return matcher === want && h.failClosed === true;
  };

  let hooksMerged = hooksTemplate;
  if ((await pathExists(hooksJsonPath)) && !options.force) {
    try {
      const existingHooks = JSON.parse(await readFile(hooksJsonPath, 'utf8')) as {
        version?: number;
        hooks?: Record<string, Array<Record<string, unknown>>>;
      };
      const pre = existingHooks.hooks?.preToolUse ?? [];
      const gateIdx = pre.findIndex(
        (h) => typeof h.command === 'string' && h.command.includes('neuron-gate'),
      );
      if (gateIdx < 0) {
        hooksMerged = {
          version: existingHooks.version ?? 1,
          hooks: {
            ...existingHooks.hooks,
            preToolUse: [...pre, ...(hooksTemplate.hooks.preToolUse ?? [])],
            afterFileEdit: [
              ...(existingHooks.hooks?.afterFileEdit ?? []),
              ...(hooksTemplate.hooks.afterFileEdit ?? []),
            ],
          },
        };
      } else if (!gateEntryFresh(pre[gateIdx]!)) {
        const nextPre = [...pre];
        nextPre[gateIdx] = { ...(hooksTemplate.hooks.preToolUse?.[0] ?? nextPre[gateIdx]!) };
        hooksMerged = {
          version: existingHooks.version ?? 1,
          hooks: {
            ...existingHooks.hooks,
            preToolUse: nextPre,
            afterFileEdit:
              existingHooks.hooks?.afterFileEdit ?? hooksTemplate.hooks.afterFileEdit ?? [],
          },
        };
      } else {
        hooksMerged = existingHooks as typeof hooksTemplate;
      }
    } catch {
      hooksMerged = hooksTemplate;
    }
  }
  await writeFile(hooksJsonPath, `${JSON.stringify(hooksMerged, null, 2)}\n`, 'utf8');

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

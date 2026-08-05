import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateCursorMcpConfig } from './mcp-config.js';

export interface CursorDoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
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
    detail: cursorExists ? cursorDir : 'Missing .cursor/ — run neuron cursor setup',
    fix: 'neuron cursor setup',
  });

  const mcpPath = join(cursorDir, 'mcp.json');
  if (await exists(mcpPath)) {
    try {
      const raw = JSON.parse(await readFile(mcpPath, 'utf8')) as unknown;
      const v = validateCursorMcpConfig(raw);
      checks.push({
        name: 'MCP config valid',
        ok: v.ok,
        detail: v.ok
          ? `neuron → ${v.neuron?.command} ${(v.neuron?.args ?? []).join(' ')}`
          : v.errors.join('; '),
        fix: 'neuron cursor setup --force',
      });
      for (const w of v.warnings) {
        checks.push({
          name: 'MCP warning',
          ok: true,
          detail: w,
        });
      }
    } catch (error) {
      checks.push({
        name: 'MCP config valid',
        ok: false,
        detail: String(error),
        fix: 'neuron cursor setup --force',
      });
    }
  } else {
    checks.push({
      name: 'MCP config valid',
      ok: false,
      detail: 'Missing .cursor/mcp.json',
      fix: 'neuron cursor setup',
    });
  }

  const rulesPath = join(cursorDir, 'rules', 'neuron-memory.mdc');
  checks.push({
    name: 'Neuron rules',
    ok: await exists(rulesPath),
    detail: (await exists(rulesPath)) ? rulesPath : 'Missing neuron-memory.mdc',
    fix: 'neuron cursor setup --force',
  });

  const skillPath = join(cursorDir, 'skills', 'neuron-memory', 'SKILL.md');
  checks.push({
    name: 'Neuron skill',
    ok: await exists(skillPath),
    detail: (await exists(skillPath)) ? skillPath : 'Missing skills/neuron-memory/SKILL.md',
    fix: 'neuron cursor setup --force',
  });

  const commands = [
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
  let cmdOk = 0;
  for (const c of commands) {
    if (await exists(join(cursorDir, 'commands', c))) cmdOk += 1;
  }
  checks.push({
    name: 'Cursor commands',
    ok: cmdOk === commands.length,
    detail: `${cmdOk}/${commands.length} command prompts installed`,
    fix: 'neuron cursor setup --force',
  });

  const brainFiles = [
    'project.json',
    'architecture.md',
    'decisions.md',
    'patterns.md',
    'warnings.md',
  ];
  let brainOk = 0;
  for (const f of brainFiles) {
    if (await exists(join(neuronDir, f))) brainOk += 1;
  }
  checks.push({
    name: 'Project brain files',
    ok: brainOk === brainFiles.length,
    detail:
      brainOk === brainFiles.length
        ? `.neuron/{${brainFiles.join(',')}}`
        : `${brainOk}/${brainFiles.length} brain files — run neuron init cursor`,
    fix: 'neuron init cursor',
  });

  // Soft check: can we resolve `neuron` somehow?
  checks.push({
    name: 'MCP launch path',
    ok: true,
    detail:
      'Host should run `neuron mcp` (ensure neuron is on PATH, or use pnpm exec from monorepo)',
  });

  const ok = checks.every((c) => c.ok);
  return { checks, ok };
}

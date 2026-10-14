#!/usr/bin/env node
/**
 * Cursor preToolUse / afterFileEdit hook: block Write/edit tools while
 * `.neuron/workflow/gate.json` has unanswered clarify (codingAllowed=false).
 * This is real host enforcement — not a soft skill prompt.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

function gateActive(cwd) {
  const p = join(cwd, '.neuron', 'workflow', 'gate.json');
  if (!existsSync(p)) return null;
  try {
    const g = JSON.parse(readFileSync(p, 'utf8'));
    if (!g?.required) return null;
    const pending = (g.questionIds ?? []).filter((id) => !(g.answeredIds ?? []).includes(id));
    if (!pending.length) return null;
    return { reason: g.reason ?? 'clarify required', pending };
  } catch {
    return null;
  }
}

const MUTATING =
  /^(Write|StrReplace|EditNotebook|Delete|CreatePlan|ApplyPatch|NotebookEdit)$/i;

const raw = await readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

const cwd = process.cwd();
const tool =
  payload.toolName ||
  payload.tool ||
  payload.name ||
  payload.tool_name ||
  '';

const active = gateActive(cwd);
if (active && MUTATING.test(String(tool))) {
  const msg = [
    'Neuron deliver gate is open — application edits are blocked.',
    `Pending clarify: ${active.pending.join(', ')}.`,
    `Reason: ${active.reason}`,
    'Call neuron_resolve_clarify until gate.json clears (present.codingAllowed=true).',
  ].join(' ');
  process.stdout.write(
    JSON.stringify({
      permission: 'deny',
      user_message: msg,
      agent_message: msg,
    }),
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ permission: 'allow' }));
process.exit(0);

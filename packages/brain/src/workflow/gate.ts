import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

import { nowIso } from '../defaults.js';
import type { DeliverGateState, DeliverPlaybook } from '../models.js';
import type { ProjectBrain } from '../project-brain.js';

export async function readDeliverGate(brain: ProjectBrain): Promise<DeliverGateState | null> {
  if (!existsSync(brain.paths.workflowGate)) return null;
  try {
    return JSON.parse(await readFile(brain.paths.workflowGate, 'utf8')) as DeliverGateState;
  } catch {
    return null;
  }
}

export function isGateActive(gate: DeliverGateState | null): boolean {
  if (!gate?.required) return false;
  const pending = gate.questionIds.filter((id) => !gate.answeredIds.includes(id));
  return pending.length > 0;
}

/** Atomic JSON write with short retries — Windows EPERM/EBUSY on rename is common. */
async function writeGateFile(path: string, value: unknown, attempts = 5): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    const tmp = `${path}.tmp.${randomUUID()}`;
    try {
      await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await rename(tmp, path);
      return;
    } catch (err) {
      lastErr = err;
      try {
        await rm(tmp, { force: true });
      } catch {
        // ignore cleanup
      }
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EEXIST' && code !== 'ENOENT') {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function writeDeliverGate(
  brain: ProjectBrain,
  input: {
    reason: string;
    until: DeliverGateState['until'];
    questionIds: string[];
    task?: string;
    playbook?: DeliverPlaybook;
    previous?: DeliverGateState | null;
  },
): Promise<DeliverGateState> {
  await mkdir(brain.paths.workflowDir, { recursive: true });
  const prev = input.previous ?? (await readDeliverGate(brain));
  const answeredIds = (prev?.answeredIds ?? []).filter((id) => input.questionIds.includes(id));
  const next: DeliverGateState = {
    version: 1,
    required: true,
    reason: input.reason,
    until: input.until,
    questionIds: input.questionIds,
    answeredIds,
    task: input.task ?? prev?.task,
    playbook: input.playbook ?? prev?.playbook,
    createdAt: prev?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await writeGateFile(brain.paths.workflowGate, next);
  return next;
}

/** Mark one clarify id answered; clear file when none remain. */
export async function answerDeliverGate(
  brain: ProjectBrain,
  questionId: string,
): Promise<{ gate: DeliverGateState | null; cleared: boolean }> {
  const current = await readDeliverGate(brain);
  if (!current) return { gate: null, cleared: true };

  const answeredIds = [...new Set([...current.answeredIds, questionId])];
  const pending = current.questionIds.filter((id) => !answeredIds.includes(id));
  if (pending.length === 0) {
    await clearDeliverGate(brain);
    return { gate: null, cleared: true };
  }

  const next: DeliverGateState = {
    ...current,
    answeredIds,
    updatedAt: nowIso(),
  };
  await writeGateFile(brain.paths.workflowGate, next);
  return { gate: next, cleared: false };
}

export async function clearDeliverGate(brain: ProjectBrain): Promise<void> {
  try {
    await rm(brain.paths.workflowGate, { force: true });
  } catch {
    // ignore
  }
}

export async function gateBlocksExecute(brain: ProjectBrain): Promise<boolean> {
  return isGateActive(await readDeliverGate(brain));
}

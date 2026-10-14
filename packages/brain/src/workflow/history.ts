import { appendFile, mkdir } from 'node:fs/promises';

import { nowIso } from '../defaults.js';
import type { WorkflowBoard } from '../models.js';
import type { ProjectBrain } from '../project-brain.js';

export interface DeliverHistoryEntry {
  at: string;
  goal: string;
  playbook?: string;
  express?: boolean;
  remembered: boolean;
  verifyOk?: boolean;
  checklistOk?: boolean;
  proposeWavesUsed?: boolean;
  clarifyQuestionCount?: number;
  wavesTotal?: number;
}

export async function appendDeliverHistory(
  brain: ProjectBrain,
  board: WorkflowBoard,
): Promise<void> {
  await mkdir(brain.paths.workflowDir, { recursive: true });
  const entry: DeliverHistoryEntry = {
    at: nowIso(),
    goal: board.goal,
    playbook: board.playbook,
    express: board.signals?.express,
    remembered: Boolean(board.remembered),
    verifyOk: board.signals?.verifyOk,
    checklistOk: board.signals?.checklistOk,
    proposeWavesUsed: board.signals?.proposeWavesUsed,
    clarifyQuestionCount: board.signals?.clarifyQuestionCount,
    wavesTotal: board.signals?.wavesTotal ?? board.waves.length,
  };
  await appendFile(brain.paths.workflowHistory, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function readDeliverHistory(
  brain: ProjectBrain,
  limit = 20,
): Promise<DeliverHistoryEntry[]> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    if (!existsSync(brain.paths.workflowHistory)) return [];
    const raw = await readFile(brain.paths.workflowHistory, 'utf8');
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: DeliverHistoryEntry[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        parsed.push(JSON.parse(line) as DeliverHistoryEntry);
      } catch {
        // skip bad line
      }
    }
    return parsed;
  } catch {
    return [];
  }
}

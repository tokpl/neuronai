import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { nowIso } from '../defaults.js';
import type { WorkflowBoard } from '../models.js';
import type { ProjectBrain } from '../project-brain.js';

/**
 * Team-visible deliver receipt (commit-friendly). Complements gitignored history.jsonl.
 */
export async function writeLastDeliverMd(
  brain: ProjectBrain,
  board: WorkflowBoard,
): Promise<string> {
  await mkdir(brain.paths.workflowDir, { recursive: true });
  const path = join(brain.paths.workflowDir, 'LAST_DELIVER.md');
  const s = board.signals ?? {};
  const md = [
    `# Last Neuron deliver`,
    '',
    `Updated: ${nowIso()}`,
    '',
    `## Goal`,
    '',
    board.goal,
    '',
    `## Outcome`,
    '',
    `- Playbook: **${board.playbook ?? 'build'}**`,
    `- Remembered: **${board.remembered ? 'yes' : 'no'}**`,
    `- Express: ${s.express ?? false}`,
    `- Propose waves: ${s.proposeWavesUsed ?? false} (quality: ${s.proposeQuality ?? '—'})`,
    `- Checklist: ${(s.checklistDone ?? []).join(', ') || '—'}`,
    `- Verify ok: ${s.verifyOk ?? '—'}`,
    `- Waves: ${s.wavesCompleted ?? 0}/${s.wavesTotal ?? board.waves.length}`,
    '',
    `## Brain refs`,
    '',
    ...(board.brainRefs?.length ? board.brainRefs.map((r) => `- ${r}`) : ['- _(none)_']),
    '',
    `## Blueprint`,
    '',
    board.blueprint?.trim() || '_(none)_',
    '',
  ].join('\n');
  await writeFile(path, md, 'utf8');
  return path;
}

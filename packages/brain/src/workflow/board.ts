import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { nowIso } from '../defaults.js';
import type { WorkflowBoard } from '../models.js';
import type { ProjectBrain } from '../project-brain.js';
import { assertBoardTransition } from './board-validate.js';
import { writeFeedbackArtifacts } from './feedback-artifacts.js';
import { gateBlocksExecute } from './gate.js';
import { appendDeliverHistory } from './history.js';
import { writeLastDeliverMd } from './last-deliver.js';

export async function readWorkflowBoard(brain: ProjectBrain): Promise<WorkflowBoard | null> {
  if (!existsSync(brain.paths.workflowBoard)) return null;
  try {
    return JSON.parse(await readFile(brain.paths.workflowBoard, 'utf8')) as WorkflowBoard;
  } catch {
    return null;
  }
}

export async function writeWorkflowBoard(
  brain: ProjectBrain,
  board: WorkflowBoard,
  options: { previous?: WorkflowBoard | null; skipValidate?: boolean } = {},
): Promise<string> {
  await mkdir(brain.paths.workflowDir, { recursive: true });
  const previous =
    options.previous !== undefined ? options.previous : await readWorkflowBoard(brain);
  let next: WorkflowBoard = {
    ...board,
    version: 1,
    updatedAt: nowIso(),
    scripts: board.scripts ?? brain.prefs?.workflow?.scripts,
  };
  if (!options.skipValidate) {
    const gateActive = await gateBlocksExecute(brain);
    next = assertBoardTransition(next, previous, {
      gateActive,
      projectRoot: brain.paths.projectRoot,
      evidenceDir:
        brain.prefs?.workflow?.mobileEvidenceDir ?? brain.paths.workflowEvidence,
    });
  }
  await writeFile(brain.paths.workflowBoard, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  if (next.phase === 'completed' && next.remembered && previous?.phase !== 'completed') {
    try {
      await appendDeliverHistory(brain, next);
      await writeLastDeliverMd(brain, next);
    } catch {
      // history / LAST_DELIVER are best-effort
    }
  }

  const md = [
    `# Neuron deliver board`,
    '',
    `Goal: ${next.goal}`,
    `Playbook: **${next.playbook ?? 'build'}**`,
    `Phase: **${next.phase}** · Status: **${next.status}**`,
    `Updated: ${next.updatedAt}`,
    `Remembered: **${next.remembered ? 'yes' : 'no'}**`,
    '',
    '## Blueprint',
    '',
    next.blueprint?.trim() || '_(pending approval)_',
    '',
    '## Brain grounding',
    '',
    ...(next.brainRefs?.length
      ? next.brainRefs.map((r) => `- ${r}`)
      : ['- _(call neuron_context and record titles/paths here)_']),
    '',
    '## Clarify answers',
    '',
    ...(next.clarifyAnswers?.length
      ? next.clarifyAnswers.map((a) => `- **${a.questionId}**: ${a.answer}`)
      : ['- _(none yet — use neuron_resolve_clarify)_']),
    '',
    '## Waves',
    '',
    ...next.waves.flatMap((w) => [
      `### ${w.id} — ${w.title} (${w.status})`,
      ...(w.dependsOn?.length ? [`Depends on: ${w.dependsOn.join(', ')}`] : []),
      ...(w.paths?.length ? [`Paths: ${w.paths.map((p) => `\`${p}\``).join(', ')}`] : []),
      ...w.tasks.map((t) => `- ${t}`),
      '',
    ]),
    '## Scripts (from Project Brain prefs — not invented)',
    '',
    ...Object.entries(next.scripts ?? {}).map(([k, v]) => `- ${k}: \`${v}\``),
    '',
    '## Signals',
    '',
    `- waves: ${next.signals?.wavesCompleted ?? 0}/${next.signals?.wavesTotal ?? next.waves.length}`,
    `- checklistOk: ${next.signals?.checklistOk ?? '—'}`,
    `- verifyOk: ${next.signals?.verifyOk ?? '—'}`,
    `- runbook: ${next.signals?.runbook ?? '—'}`,
    `- feedbackItems: ${next.signals?.feedbackItems?.length ?? 0}`,
    `- express: ${next.signals?.express ?? false}`,
    `- proposeWavesUsed: ${next.signals?.proposeWavesUsed ?? false}`,
    `- rememberedAt: ${next.signals?.rememberedAt ?? '—'}`,
    '',
    ...(next.signals?.feedbackItems?.length
      ? [
          '## Feedback items',
          '',
          ...next.signals.feedbackItems.map(
            (i) =>
              `- **${i.id}** [${i.status}] ${i.text.slice(0, 100)}${
                i.status === 'needs_info' && !i.userAnswer?.trim()
                  ? ` — ASK: ${i.askPrompt ?? '…'}`
                  : ''
              }`,
          ),
          '',
          'Human mirror: `.neuron/workflow/feedback/FEEDBACK.md`',
          '',
        ]
      : []),
  ].join('\n');
  const { join } = await import('node:path');
  await writeFile(join(brain.paths.workflowDir, 'board.md'), md, 'utf8');

  try {
    await writeFeedbackArtifacts(brain, next);
  } catch {
    // feedback md is best-effort
  }

  return brain.paths.workflowBoard;
}

export function emptyBoard(goal: string, scripts?: WorkflowBoard['scripts']): WorkflowBoard {
  return {
    version: 1,
    updatedAt: nowIso(),
    goal,
    phase: 'clarify',
    status: 'active',
    playbook: 'build',
    waves: [],
    scripts,
    signals: { wavesCompleted: 0, wavesTotal: 0 },
  };
}

export {
  assertBoardTransition,
  boardHealth,
  sortWavesByDepends,
  WorkflowBoardError,
} from './board-validate.js';

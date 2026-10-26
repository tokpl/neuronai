import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { nowIso } from '../defaults.js';
import type { FeedbackItem, WorkflowBoard } from '../models.js';
import type { ProjectBrain } from '../project-brain.js';
import { feedbackHasOpenAsks } from './evidence.js';

/**
 * Easel-style durable feedback workspace under `.neuron/workflow/feedback/`.
 * Agents and humans read FEEDBACK.md / OPEN_QUESTIONS.md; items.json is machine SoT mirror.
 */
export async function writeFeedbackArtifacts(
  brain: ProjectBrain,
  board: WorkflowBoard,
): Promise<{ dir: string; files: string[] } | null> {
  const items = board.signals?.feedbackItems;
  if (!items?.length && board.signals?.runbook !== 'feedback') return null;

  const dir = brain.paths.workflowFeedback;
  await mkdir(dir, { recursive: true });
  const files: string[] = [];

  const list = items ?? [];
  const open = list.filter(
    (i) => i.status === 'needs_info' && !(i.userAnswer && i.userAnswer.trim()),
  );
  const todo = list.filter((i) =>
    ['pending_triage', 'reproducing', 'confirmed', 'needs_info', 'fixed'].includes(i.status),
  );
  const done = list.filter((i) =>
    ['verified', 'cannot_repro', 'by_design'].includes(i.status),
  );

  const feedbackMd = [
    `# Feedback triage`,
    '',
    `Updated: ${nowIso()}`,
    '',
    `Goal: ${board.goal.split(/\r?\n/)[0]?.slice(0, 120) ?? board.goal}`,
    `Phase: **${board.phase}** · Runbook: **${board.signals?.runbook ?? '—'}**`,
    '',
    `Counts: ${list.length} items · ${open.length} open asks · ${done.length} closed`,
    '',
    `Evidence: \`.neuron/workflow/evidence/fb-*/\``,
    '',
    `## To do`,
    '',
    ...(todo.length ? todo.map((i) => formatItemBullet(i)) : ['- _(none)_']),
    '',
    `## Done / closed`,
    '',
    ...(done.length ? done.map((i) => formatItemBullet(i)) : ['- _(none)_']),
    '',
    `## How to answer open questions`,
    '',
    '1. Prefer Cursor **AskQuestion** when the tool exists.',
    '2. In **Agent mode** (no AskQuestion): answer **in chat** — quote the `fb-id`.',
    '3. Agent then `set_board` with `feedbackItems[].userAnswer` and clears the ask.',
    '',
    'See also: `OPEN_QUESTIONS.md` in this folder.',
    '',
  ].join('\n');

  const feedbackPath = join(dir, 'FEEDBACK.md');
  await writeFile(feedbackPath, feedbackMd, 'utf8');
  files.push(feedbackPath);

  const questionsMd = [
    `# Open feedback questions`,
    '',
    `Updated: ${nowIso()}`,
    '',
    open.length === 0
      ? '_No open questions. Agent may continue Fix for confirmed items._'
      : [
          'Agent mode: **reply in chat** with answers (AskQuestion often unavailable).',
          '',
          ...open.flatMap((i) => [
            `## ${i.id}`,
            '',
            `**Item:** ${i.text}`,
            '',
            `**Question:** ${i.askPrompt?.trim() || '_(agent must fill askPrompt)_'}`,
            '',
            `**Your answer:** _(reply in chat, e.g. \`${i.id}: …\`)_`,
            '',
          ]),
        ].join('\n'),
    '',
  ].join('\n');

  const questionsPath = join(dir, 'OPEN_QUESTIONS.md');
  await writeFile(questionsPath, questionsMd, 'utf8');
  files.push(questionsPath);

  const jsonPath = join(dir, 'items.json');
  await writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        updatedAt: nowIso(),
        goal: board.goal,
        phase: board.phase,
        runbook: board.signals?.runbook,
        hasOpenAsks: feedbackHasOpenAsks(list),
        items: list,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  files.push(jsonPath);

  return { dir, files };
}

function formatItemBullet(i: FeedbackItem): string {
  const ev =
    [
      ...(i.evidenceBefore?.length ? [`before: ${i.evidenceBefore.join(', ')}`] : []),
      ...(i.evidenceAfter?.length ? [`after: ${i.evidenceAfter.join(', ')}`] : []),
    ].join('; ') || '';
  const ask =
    i.status === 'needs_info' && !i.userAnswer?.trim()
      ? ` — **ASK:** ${i.askPrompt?.trim() || 'needs clarification'}`
      : i.userAnswer?.trim()
        ? ` — answer: ${i.userAnswer.trim().slice(0, 80)}`
        : '';
  return `- **${i.id}** [${i.status}] ${i.text.slice(0, 120)}${ask}${ev ? ` (${ev})` : ''}${
    i.surface && i.surface !== 'unknown' ? ` · ${i.surface}` : ''
  }`;
}

/** Instruction block for MCP / skill when feedback has open asks. */
export function feedbackChatAskInstruction(items: FeedbackItem[] | undefined): string | null {
  if (!feedbackHasOpenAsks(items)) return null;
  const open = (items ?? []).filter(
    (i) => i.status === 'needs_info' && !i.userAnswer?.trim(),
  );
  const lines = open.map(
    (i) => `- **${i.id}:** ${i.askPrompt?.trim() || i.text.slice(0, 100)}`,
  );
  return [
    'AskQuestion unavailable in Agent mode — ask the user **in chat** (one batch OK).',
    'Also wrote `.neuron/workflow/feedback/OPEN_QUESTIONS.md`.',
    'Do not Fix until answers are stored as feedbackItems[].userAnswer via set_board.',
    '',
    ...lines,
  ].join('\n');
}

import {
  boardHealth,
  checklistComplete,
  detectRunbook,
  emptyBoard,
  isDeliverRunbook,
  missingChecklistIds,
  missingEvidenceNotes,
  playbookChecklist,
  playbookRequiresEvidenceNotes,
  proposeDeliverWaves,
  readDeliverGate,
  readDeliverHistory,
  readWorkflowBoard,
  writeWorkflowBoard,
  type DeliverPlaybook,
  type DeliverRunbook,
  type WorkflowBoard,
} from '@neuronai/brain';

import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

/**
 * Read / write the deliver board owned by Project Brain (.neuron/workflow/).
 */
export async function handleWorkflow(
  runtime: McpRuntime,
  args: {
    action: 'get_board' | 'set_board' | 'clear_board' | 'propose_waves' | 'complete_checklist';
    board?: Partial<WorkflowBoard> & { goal?: string };
    seedPath?: string;
    playbook?: DeliverPlaybook;
    runbook?: DeliverRunbook;
    checklistDone?: string[];
    checklistNotes?: Record<string, string>;
  },
) {
  try {
    const brain = runtime.neuron.brain;

    if (args.action === 'get_board') {
      const board = await readWorkflowBoard(brain);
      const gate = await readDeliverGate(brain);
      const history = await readDeliverHistory(brain, 10);
      return okResult({
        board,
        path: brain.paths.workflowBoard,
        scripts: brain.prefs?.workflow?.scripts ?? null,
        health: boardHealth(board),
        gate,
        history,
      });
    }

    if (args.action === 'clear_board') {
      const { rm } = await import('node:fs/promises');
      const { join } = await import('node:path');
      try {
        await rm(brain.paths.workflowBoard, { force: true });
        await rm(join(brain.paths.workflowDir, 'board.md'), { force: true });
      } catch {
        // ignore
      }
      return okResult({ cleared: true });
    }

    if (args.action === 'propose_waves') {
      const existing =
        (await readWorkflowBoard(brain)) ?? emptyBoard(args.board?.goal ?? args.seedPath ?? 'untitled');
      const playbook = (args.playbook ?? args.board?.playbook ?? existing.playbook ?? 'build') as DeliverPlaybook;
      const goal = args.board?.goal ?? existing.goal;
      const runbook = detectRunbook(
        goal,
        isDeliverRunbook(args.runbook) ? args.runbook : undefined,
      );
      const proposed = proposeDeliverWaves(brain, {
        goal,
        playbook,
        runbook,
        seedPath: args.seedPath,
      });
      const next: WorkflowBoard = {
        ...existing,
        goal,
        playbook,
        phase: 'decompose',
        status: 'active',
        waves: proposed.waves,
        scripts: existing.scripts ?? brain.prefs?.workflow?.scripts,
        signals: {
          ...existing.signals,
          proposeWavesUsed: true,
          proposeQuality: proposed.quality,
          runbook: proposed.runbook,
          express: existing.signals?.express,
        },
      };
      const path = await writeWorkflowBoard(brain, next, { previous: existing });
      const saved = await readWorkflowBoard(brain);
      return okResult({
        board: saved,
        path,
        health: boardHealth(saved),
        proposed: {
          seedPath: proposed.seedPath,
          usedCode: proposed.usedCode,
          quality: proposed.quality,
          runbook: proposed.runbook,
          waveCount: proposed.waves.length,
        },
      });
    }

    if (args.action === 'complete_checklist') {
      const existing = await readWorkflowBoard(brain);
      if (!existing) {
        return failResult(new Error('No deliver board — set_board or propose_waves first'));
      }
      const playbook = (args.playbook ?? existing.playbook ?? 'build') as DeliverPlaybook;
      const checklistDone = args.checklistDone ?? existing.signals?.checklistDone ?? [];
      const checklistNotes = {
        ...existing.signals?.checklistNotes,
        ...args.checklistNotes,
      };
      const missing = missingChecklistIds(playbook, checklistDone);
      if (missing.length) {
        return okResult({
          ok: false,
          checklistOk: false,
          missing,
          required: playbookChecklist(playbook),
          instruction:
            'Pass every playbook checklist id in checklistDone with notes proving the check — then retry complete_checklist.',
        });
      }
      const missingNotes = missingEvidenceNotes(playbook, checklistDone, checklistNotes);
      if (missingNotes.length) {
        return okResult({
          ok: false,
          checklistOk: false,
          missingNotes,
          requiresEvidenceNotes: playbookRequiresEvidenceNotes(playbook),
          required: playbookChecklist(playbook),
          instruction:
            'Reality-check: build/ui require checklistNotes[id] (≥3 chars) for every checklist id — script output, path, or screenshot — then retry complete_checklist. Default status is NEEDS WORK until notes exist.',
        });
      }
      const next: WorkflowBoard = {
        ...existing,
        playbook,
        signals: {
          ...existing.signals,
          checklistDone,
          checklistNotes,
          checklistOk: true,
        },
      };
      const path = await writeWorkflowBoard(brain, next, { previous: existing });
      return okResult({
        ok: true,
        checklistOk: checklistComplete(playbook, checklistDone, checklistNotes),
        board: await readWorkflowBoard(brain),
        path,
        health: boardHealth(await readWorkflowBoard(brain)),
      });
    }

    // set_board
    const existing = (await readWorkflowBoard(brain)) ?? emptyBoard(args.board?.goal ?? 'untitled');
    const patch = args.board ?? {};
    const next: WorkflowBoard = {
      ...existing,
      ...patch,
      version: 1,
      goal: patch.goal ?? existing.goal,
      phase: patch.phase ?? existing.phase,
      status: patch.status ?? existing.status,
      playbook: patch.playbook ?? existing.playbook,
      waves: patch.waves ?? existing.waves,
      scripts: patch.scripts ?? existing.scripts ?? brain.prefs?.workflow?.scripts,
      blueprint: patch.blueprint ?? existing.blueprint,
      clarifyAnswers: patch.clarifyAnswers ?? existing.clarifyAnswers,
      brainRefs: patch.brainRefs ?? existing.brainRefs,
      remembered: patch.remembered ?? existing.remembered,
      signals: { ...existing.signals, ...patch.signals },
      updatedAt: existing.updatedAt,
    };
    const path = await writeWorkflowBoard(brain, next, { previous: existing });
    const saved = await readWorkflowBoard(brain);
    return okResult({ board: saved, path, health: boardHealth(saved) });
  } catch (error) {
    return failResult(error);
  }
}

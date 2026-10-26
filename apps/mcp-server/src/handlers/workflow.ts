import {
  boardHealth,
  checklistComplete,
  detectPlaybook,
  detectRunbook,
  emptyBoard,
  feedbackHasOpenAsks,
  isDeliverRunbook,
  missingChecklistIds,
  missingEvidenceFiles,
  missingEvidenceNotes,
  normalizePlaybook,
  parseFeedbackItems,
  playbookRequiresEvidenceFiles,
  playbookRequiresEvidenceNotes,
  proposeDeliverWaves,
  readDeliverGate,
  readDeliverHistory,
  readWorkflowBoard,
  resolveDeliverChecklist,
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
        deviceId: brain.prefs?.workflow?.deviceId ?? null,
        evidenceDir:
          brain.prefs?.workflow?.mobileEvidenceDir ?? brain.paths.workflowEvidence,
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
      const goal = args.board?.goal ?? existing.goal;
      const detectedPlaybook = detectPlaybook(goal);
      const rawPlaybook = (args.playbook ??
        args.board?.playbook ??
        existing.playbook ??
        detectedPlaybook) as DeliverPlaybook;
      const playbook = normalizePlaybook(rawPlaybook);
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

      const feedbackItems =
        runbook === 'feedback'
          ? existing.signals?.feedbackItems?.length
            ? existing.signals.feedbackItems
            : parseFeedbackItems(goal)
          : existing.signals?.feedbackItems;

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
          feedbackItems,
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
          feedbackItemCount: feedbackItems?.length ?? 0,
        },
      });
    }

    if (args.action === 'complete_checklist') {
      const existing = await readWorkflowBoard(brain);
      if (!existing) {
        return failResult(new Error('No deliver board — set_board or propose_waves first'));
      }
      const playbook = normalizePlaybook(
        (args.playbook ?? existing.playbook ?? 'build') as DeliverPlaybook,
      );
      const runbook = existing.signals?.runbook;
      const checklistDone = args.checklistDone ?? existing.signals?.checklistDone ?? [];
      const checklistNotes = {
        ...existing.signals?.checklistNotes,
        ...args.checklistNotes,
      };
      const evidenceDir =
        brain.prefs?.workflow?.mobileEvidenceDir ?? brain.paths.workflowEvidence;
      const required = resolveDeliverChecklist(playbook, runbook);

      if (runbook === 'feedback' && feedbackHasOpenAsks(existing.signals?.feedbackItems)) {
        return okResult({
          ok: false,
          checklistOk: false,
          openAsks: existing.signals?.feedbackItems?.filter(
            (i) => i.status === 'needs_info' && !i.userAnswer?.trim(),
          ),
          instruction:
            'Feedback still has needs_info without userAnswer. AskQuestion the user, set_board with userAnswer on those items, then retry complete_checklist.',
        });
      }

      const missing = missingChecklistIds(playbook, checklistDone, runbook);
      if (missing.length) {
        return okResult({
          ok: false,
          checklistOk: false,
          missing,
          required,
          instruction:
            'Pass every checklist id in checklistDone with notes proving the check — then retry complete_checklist.',
        });
      }
      const missingNotes = missingEvidenceNotes(
        playbook,
        checklistDone,
        checklistNotes,
        runbook,
      );
      if (missingNotes.length) {
        return okResult({
          ok: false,
          checklistOk: false,
          missingNotes,
          requiresEvidenceNotes: playbookRequiresEvidenceNotes(playbook, runbook),
          required,
          instruction:
            'Reality-check: checklistNotes[id] (≥3 chars) required — for feedback also existing screenshot paths under .neuron/workflow/evidence/.',
        });
      }
      if (playbookRequiresEvidenceFiles(playbook, runbook)) {
        const missingFiles = missingEvidenceFiles({
          requireScreenshotNotes: true,
          notes: checklistNotes,
          feedbackItems: existing.signals?.feedbackItems,
          projectRoot: brain.paths.projectRoot,
          evidenceDir,
        });
        if (missingFiles.length) {
          return okResult({
            ok: false,
            checklistOk: false,
            missingFiles,
            requiresEvidenceFiles: true,
            evidenceDir,
            required,
            instruction:
              'Feedback reality-check: notes must point at existing PNGs under .neuron/workflow/evidence/ (browser shot, adb, or PHP UI). Capture then retry.',
          });
        }
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
        checklistOk: checklistComplete(playbook, checklistDone, checklistNotes, {
          projectRoot: brain.paths.projectRoot,
          evidenceDir,
          feedbackItems: existing.signals?.feedbackItems,
          runbook,
        }),
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

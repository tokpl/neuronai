import type { WorkflowBoard } from '../models.js';
import { missingChecklistIds } from './playbooks.js';

export class WorkflowBoardError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkflowBoardError';
    this.code = code;
  }
}

export interface AssertBoardOptions {
  /** True when `.neuron/workflow/gate.json` still has unanswered clarify. */
  gateActive?: boolean;
}

/** Topological-ish order: waves with unmet dependsOn come after dependencies. */
export function sortWavesByDepends(
  waves: WorkflowBoard['waves'],
): WorkflowBoard['waves'] {
  const byId = new Map(waves.map((w) => [w.id, w]));
  const visited = new Set<string>();
  const out: WorkflowBoard['waves'] = [];

  const visit = (id: string, stack: Set<string>) => {
    if (visited.has(id)) return;
    if (stack.has(id)) {
      throw new WorkflowBoardError('WAVE_CYCLE', `Wave dependency cycle at "${id}"`);
    }
    const w = byId.get(id);
    if (!w) return;
    stack.add(id);
    for (const dep of w.dependsOn ?? []) visit(dep, stack);
    stack.delete(id);
    visited.add(id);
    out.push(w);
  };

  for (const w of waves) visit(w.id, new Set());
  return out;
}

function waveReady(
  wave: WorkflowBoard['waves'][number],
  byId: Map<string, WorkflowBoard['waves'][number]>,
): boolean {
  for (const dep of wave.dependsOn ?? []) {
    const d = byId.get(dep);
    if (!d || d.status !== 'done') return false;
  }
  return true;
}

/**
 * Enforce board integrity — turns soft Absolute boards into Brain-checked state.
 * Throws WorkflowBoardError when the agent tries to skip the moat.
 */
export function assertBoardTransition(
  next: WorkflowBoard,
  previous: WorkflowBoard | null,
  options: AssertBoardOptions = {},
): WorkflowBoard {
  const execPhases = ['execute', 'verify', 'converge', 'completed'] as const;
  if (options.gateActive && execPhases.includes(next.phase as (typeof execPhases)[number])) {
    throw new WorkflowBoardError(
      'GATE_ACTIVE',
      `Cannot enter phase "${next.phase}" while deliver gate is open — finish neuron_resolve_clarify first`,
    );
  }

  if (
    !next.signals?.express &&
    execPhases.includes(next.phase as (typeof execPhases)[number]) &&
    (next.clarifyAnswers?.length ?? 0) === 0 &&
    previous &&
    (previous.clarifyAnswers?.length ?? 0) === 0 &&
    next.phase !== 'decompose'
  ) {
    // Non-express delivers that never recorded clarify answers still may proceed if gate cleared
    // (express or user skipped). Only block execute when gateActive already handled above.
  }

  const waves = sortWavesByDepends(next.waves ?? []);
  const byId = new Map(waves.map((w) => [w.id, w]));

  for (const w of waves) {
    for (const dep of w.dependsOn ?? []) {
      if (!byId.has(dep)) {
        throw new WorkflowBoardError(
          'MISSING_DEP',
          `Wave "${w.id}" depends on unknown wave "${dep}"`,
        );
      }
    }
    if (
      (w.status === 'in_progress' || w.status === 'done') &&
      !waveReady(w, byId)
    ) {
      throw new WorkflowBoardError(
        'DEP_NOT_DONE',
        `Wave "${w.id}" cannot be ${w.status} until dependsOn are done`,
      );
    }
  }

  const wavesDone = waves.filter((w) => w.status === 'done').length;
  const wavesTotal = waves.length;

  if (next.phase === 'execute' || next.phase === 'verify' || next.phase === 'converge') {
    if (wavesTotal === 0) {
      throw new WorkflowBoardError(
        'NO_WAVES',
        `Cannot enter phase "${next.phase}" with an empty wave list — decompose first`,
      );
    }
  }

  const missingChecks = missingChecklistIds(next.playbook, next.signals?.checklistDone);
  if (next.signals?.checklistOk && missingChecks.length > 0) {
    throw new WorkflowBoardError(
      'CHECKLIST_EVIDENCE',
      `checklistOk requires signals.checklistDone to cover all playbook items; missing: ${missingChecks.join(', ')}`,
    );
  }
  if (next.signals?.verifyOk) {
    if (!next.signals?.checklistOk) {
      throw new WorkflowBoardError(
        'CHECKLIST',
        'signals.verifyOk requires signals.checklistOk (finish playbook checklist first)',
      );
    }
    if (missingChecks.length > 0) {
      throw new WorkflowBoardError(
        'CHECKLIST_EVIDENCE',
        `verifyOk blocked — checklistDone incomplete: ${missingChecks.join(', ')}`,
      );
    }
  }

  if (next.phase === 'verify' || next.phase === 'converge' || next.phase === 'completed') {
    const blocked = waves.filter((w) => w.status === 'blocked');
    const pending = waves.filter((w) => w.status !== 'done' && w.status !== 'blocked');
    if (next.phase === 'completed' && pending.length > 0) {
      throw new WorkflowBoardError(
        'WAVES_INCOMPLETE',
        `Cannot complete deliver: ${pending.length} wave(s) still not done`,
      );
    }
    if (next.phase === 'completed' && blocked.length > 0 && !next.signals?.verifyOk) {
      throw new WorkflowBoardError(
        'BLOCKED_WAVES',
        'Cannot complete with blocked waves unless signals.verifyOk is true (user accepted)',
      );
    }
  }

  if (next.phase === 'completed' && !next.remembered) {
    throw new WorkflowBoardError(
      'NOT_REMEMBERED',
      'Cannot mark phase completed until remembered=true (call neuron_after_task first)',
    );
  }

  if (next.remembered && previous && !previous.remembered && !next.signals?.rememberedAt) {
    next = {
      ...next,
      signals: {
        ...next.signals,
        rememberedAt: new Date().toISOString(),
      },
    };
  }

  if (next.phase === 'completed' && !next.signals?.completedAt) {
    next = {
      ...next,
      signals: {
        ...next.signals,
        completedAt: new Date().toISOString(),
      },
    };
  }

  const signals: WorkflowBoard['signals'] = {
    ...next.signals,
    wavesCompleted: wavesDone,
    wavesTotal,
    gatesHonored: options.gateActive ? false : (next.signals?.gatesHonored ?? true),
  };

  return {
    ...next,
    waves,
    signals,
  };
}

/** Health checklist returned on get_board — Absolute has no equivalent. */
export function boardHealth(board: WorkflowBoard | null): {
  ok: boolean;
  issues: string[];
  nextAction: string | null;
} {
  if (!board) {
    return {
      ok: true,
      issues: [],
      nextAction: 'Start deliver: set_board with goal + playbook, phase clarify',
    };
  }
  const issues: string[] = [];
  if (!board.brainRefs?.length) issues.push('Missing brainRefs — ground in neuron_context');
  if (!board.blueprint && ['decompose', 'execute', 'verify', 'converge', 'completed'].includes(board.phase)) {
    issues.push('Missing approved blueprint');
  }
  if (!board.waves.length && ['execute', 'verify', 'converge', 'completed'].includes(board.phase)) {
    issues.push('No waves decomposed');
  }
  if (board.phase === 'completed' && !board.remembered) {
    issues.push('Marked completed without remembered — invalid');
  }
  if (board.phase !== 'completed' && board.status === 'active') {
    const pending = board.waves.filter((w) => w.status !== 'done');
    return {
      ok: issues.length === 0,
      issues,
      nextAction:
        board.phase === 'clarify'
          ? 'Finish clarify → blueprint gate'
          : board.phase === 'blueprint'
            ? 'Approve blueprint → neuron_workflow propose_waves → decompose gate'
            : board.phase === 'decompose'
              ? 'Approve board → execute first ready wave'
              : board.phase === 'execute'
                ? pending[0]
                  ? `Continue wave ${pending[0].id}`
                  : 'All waves done → playbook checklist → verify Brain scripts'
                : board.phase === 'verify'
                  ? 'Set checklistOk + verifyOk → converge + neuron_after_task'
                  : 'neuron_after_task → set remembered + completed',
    };
  }
  return {
    ok: issues.length === 0,
    issues,
    nextAction: board.remembered ? null : 'neuron_after_task then set remembered',
  };
}

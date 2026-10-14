import { describe, expect, it } from 'vitest';

import {
  assertBoardTransition,
  boardHealth,
  emptyBoard,
  WorkflowBoardError,
} from '../src/index.js';
import type { WorkflowBoard } from '../src/models.js';

function board(partial: Partial<WorkflowBoard>): WorkflowBoard {
  return {
    ...emptyBoard('test'),
    ...partial,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

describe('assertBoardTransition', () => {
  it('rejects completed without remembered', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'completed',
          status: 'completed',
          remembered: false,
          waves: [{ id: 'w1', title: 'A', status: 'done', tasks: ['x'] }],
        }),
        null,
      ),
    ).toThrow(WorkflowBoardError);
  });

  it('accepts completed when remembered', () => {
    const next = assertBoardTransition(
      board({
        phase: 'completed',
        status: 'completed',
        remembered: true,
        waves: [{ id: 'w1', title: 'A', status: 'done', tasks: ['x'] }],
      }),
      null,
    );
    expect(next.signals?.wavesCompleted).toBe(1);
  });

  it('rejects execute while gateActive', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'execute',
          waves: [{ id: 'w1', title: 'A', status: 'pending', tasks: ['x'] }],
        }),
        null,
        { gateActive: true },
      ),
    ).toThrow(/GATE_ACTIVE|gate/i);
  });

  it('rejects verifyOk without checklistOk', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'verify',
          waves: [{ id: 'w1', title: 'A', status: 'done', tasks: ['x'] }],
          signals: { verifyOk: true, checklistOk: false },
        }),
        null,
      ),
    ).toThrow(/CHECKLIST|checklist/i);
  });

  it('rejects checklistOk without checklistDone evidence', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'verify',
          playbook: 'build',
          waves: [{ id: 'w1', title: 'A', status: 'done', tasks: ['x'] }],
          signals: { checklistOk: true, checklistDone: ['scripts-green'] },
        }),
        null,
      ),
    ).toThrow(/CHECKLIST_EVIDENCE|checklistDone/i);
  });

  it('accepts checklistOk when checklistDone covers playbook', () => {
    const next = assertBoardTransition(
      board({
        phase: 'verify',
        playbook: 'build',
        waves: [{ id: 'w1', title: 'A', status: 'done', tasks: ['x'] }],
        signals: {
          checklistOk: true,
          checklistDone: ['scripts-green', 'blueprint-diff', 'paths-honored'],
        },
      }),
      null,
    );
    expect(next.signals?.checklistOk).toBe(true);
  });

  it('rejects wave done before dependsOn', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'execute',
          waves: [
            { id: 'w1', title: 'A', status: 'pending', tasks: ['a'] },
            { id: 'w2', title: 'B', status: 'done', dependsOn: ['w1'], tasks: ['b'] },
          ],
        }),
        null,
      ),
    ).toThrow(/dependsOn/);
  });

  it('sorts waves by dependsOn', () => {
    const next = assertBoardTransition(
      board({
        phase: 'decompose',
        waves: [
          { id: 'w2', title: 'B', status: 'pending', dependsOn: ['w1'], tasks: ['b'] },
          { id: 'w1', title: 'A', status: 'pending', tasks: ['a'] },
        ],
      }),
      null,
    );
    expect(next.waves.map((w) => w.id)).toEqual(['w1', 'w2']);
  });
});

describe('boardHealth', () => {
  it('suggests next action on active execute board', () => {
    const h = boardHealth(
      board({
        phase: 'execute',
        brainRefs: ['auth'],
        blueprint: 'do X',
        waves: [{ id: 'w1', title: 'A', status: 'pending', tasks: ['a'] }],
      }),
    );
    expect(h.nextAction).toMatch(/w1/);
  });
});

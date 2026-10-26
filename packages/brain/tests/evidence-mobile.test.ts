import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertBoardTransition,
  detectPlaybook,
  detectRunbook,
  emptyBoard,
  FEEDBACK_CHECKLIST,
  missingEvidenceFiles,
  openProjectBrain,
  parseFeedbackItems,
  playbookChecklist,
  proposeDeliverWaves,
  resolveDeliverChecklist,
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

describe('parseFeedbackItems', () => {
  it('parses numbered PL feedback including letter suffixes', () => {
    const items = parseFeedbackItems(`Feedback 21.10.2026_2
1. Za duża odległość
12b)widok nie scrolluje się
6. Złączone bordery
`);
    expect(items.map((i) => i.id)).toEqual(['fb-1', 'fb-12b', 'fb-6']);
    expect(items.every((i) => i.status === 'pending_triage')).toBe(true);
  });
});

describe('feedback checklist (not a mobile playbook)', () => {
  it('uses FEEDBACK_CHECKLIST when runbook is feedback', () => {
    expect(resolveDeliverChecklist('build', 'feedback')).toEqual(FEEDBACK_CHECKLIST);
    expect(resolveDeliverChecklist('ui', 'feedback').some((c) => c.id === 'asks-resolved')).toBe(
      true,
    );
    expect(detectPlaybook('Fix Flutter feed on device via adb')).toBe('ui');
    expect(detectRunbook('Feedback 21.10\n1. a\n2. b\n3. c')).toBe('feedback');
  });

  it('requires existing PNG paths for screenshots notes', () => {
    const root = mkdtempSync(join(tmpdir(), 'neuron-ev-'));
    const evidence = join(root, '.neuron', 'workflow', 'evidence', 'fb-6');
    mkdirSync(evidence, { recursive: true });
    writeFileSync(join(evidence, 'before.png'), 'fake');

    const missing = missingEvidenceFiles({
      requireScreenshotNotes: true,
      projectRoot: root,
      notes: {
        'screenshots-before': `.neuron/workflow/evidence/fb-6/before.png`,
        'screenshots-after': `.neuron/workflow/evidence/fb-6/after.png`,
      },
    });
    expect(missing.some((m) => m.includes('after'))).toBe(true);

    writeFileSync(join(evidence, 'after.png'), 'fake');
    expect(
      missingEvidenceFiles({
        requireScreenshotNotes: true,
        projectRoot: root,
        notes: {
          'screenshots-before': `.neuron/workflow/evidence/fb-6/before.png`,
          'screenshots-after': `.neuron/workflow/evidence/fb-6/after.png`,
        },
      }),
    ).toEqual([]);
  });

  it('rejects checklistOk without evidence files on feedback runbook', () => {
    const root = mkdtempSync(join(tmpdir(), 'neuron-ev-board-'));
    const ids = FEEDBACK_CHECKLIST.map((c) => c.id);
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'verify',
          playbook: 'ui',
          waves: [{ id: 'w1', title: 'A', status: 'done', tasks: ['x'] }],
          signals: {
            runbook: 'feedback',
            checklistOk: true,
            checklistDone: ids,
            checklistNotes: Object.fromEntries(
              ids.map((id) => [
                id,
                id.startsWith('screenshots')
                  ? '.neuron/workflow/evidence/missing.png'
                  : 'surface browser repro ok vision ok asks ok',
              ]),
            ),
          },
        }),
        null,
        { projectRoot: root },
      ),
    ).toThrow(/CHECKLIST_EVIDENCE_FILES|evidence/i);
  });

  it('blocks Fix when needs_info lacks userAnswer', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'execute',
          playbook: 'ui',
          waves: [
            { id: 'w1', title: 'Ingest feedback', status: 'done', tasks: ['a'] },
            {
              id: 'w2',
              title: 'Reproduce in product',
              status: 'done',
              dependsOn: ['w1'],
              tasks: ['b'],
            },
            {
              id: 'w3',
              title: 'Fix confirmed',
              status: 'in_progress',
              dependsOn: ['w2'],
              tasks: ['c'],
            },
          ],
          signals: {
            runbook: 'feedback',
            feedbackItems: [
              {
                id: 'fb-4',
                text: 'mic icon should become stop',
                status: 'needs_info',
                askPrompt: 'Should stop be red or bordowy?',
              },
            ],
          },
        }),
        null,
      ),
    ).toThrow(/FEEDBACK_ASK_USER|userAnswer/i);
  });

  it('blocks Fix without confirmed items', () => {
    expect(() =>
      assertBoardTransition(
        board({
          phase: 'execute',
          playbook: 'ui',
          waves: [
            { id: 'w1', title: 'Ingest feedback', status: 'done', tasks: ['a'] },
            {
              id: 'w2',
              title: 'Reproduce in product',
              status: 'done',
              dependsOn: ['w1'],
              tasks: ['b'],
            },
            {
              id: 'w3',
              title: 'Fix confirmed',
              status: 'in_progress',
              dependsOn: ['w2'],
              tasks: ['c'],
            },
          ],
          signals: {
            runbook: 'feedback',
            feedbackItems: [{ id: 'fb-1', text: 'gap too large', status: 'pending_triage' }],
          },
        }),
        null,
      ),
    ).toThrow(WorkflowBoardError);
  });

  it('allows Fix after userAnswer turns needs_info into confirmed', () => {
    const next = assertBoardTransition(
      board({
        phase: 'execute',
        playbook: 'ui',
        waves: [
          { id: 'w1', title: 'Ingest feedback', status: 'done', tasks: ['a'] },
          {
            id: 'w2',
            title: 'Reproduce in product',
            status: 'done',
            dependsOn: ['w1'],
            tasks: ['b'],
          },
          {
            id: 'w3',
            title: 'Fix confirmed',
            status: 'in_progress',
            dependsOn: ['w2'],
            tasks: ['c'],
          },
        ],
        signals: {
          runbook: 'feedback',
          feedbackItems: [
            {
              id: 'fb-4',
              text: 'mic → stop',
              status: 'confirmed',
              askPrompt: 'red or bordowy?',
              userAnswer: 'bordowy stop icon',
            },
          ],
        },
      }),
      null,
    );
    expect(next.waves.find((w) => w.id === 'w3')?.status).toBe('in_progress');
  });
});

describe('feedback runbook waves', () => {
  it('orders ingest → reproduce in product → fix → re-verify → remember', async () => {
    const { mkdtemp } = await import('node:fs/promises');
    const root = await mkdtemp(join(tmpdir(), 'neuron-fb-waves-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'fb', name: 'fb', stack: ['flutter'] },
    });
    const { waves, runbook } = proposeDeliverWaves(brain, {
      goal: 'Feedback list\n1. gap\n2. crash\n3. lag',
      playbook: 'ui',
      runbook: 'feedback',
      seedPath: 'lib/main.dart',
    });
    expect(runbook).toBe('feedback');
    expect(waves.map((w) => w.title)).toEqual([
      'Ingest feedback',
      'Reproduce in product',
      'Fix confirmed',
      'Re-verify with evidence',
      'Remember',
    ]);
    expect(playbookChecklist('mobile')).toEqual(FEEDBACK_CHECKLIST);
  });
});

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  emptyBoard,
  openProjectBrain,
  writeFeedbackArtifacts,
  writeWorkflowBoard,
} from '../src/index.js';

describe('writeFeedbackArtifacts', () => {
  it('writes FEEDBACK.md, OPEN_QUESTIONS.md, items.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-fb-art-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'f', name: 'f', stack: ['ts'] },
    });
    const board = emptyBoard('Feedback\n1. gap\n4. mic color?');
    board.signals = {
      runbook: 'feedback',
      feedbackItems: [
        { id: 'fb-1', text: 'gap too large', status: 'confirmed' },
        {
          id: 'fb-4',
          text: 'mic should become stop',
          status: 'needs_info',
          askPrompt: 'Red or bordowy stop icon?',
        },
      ],
    };

    const written = await writeFeedbackArtifacts(brain, board);
    expect(written?.files.length).toBe(3);

    const openQ = await readFile(join(brain.paths.workflowFeedback, 'OPEN_QUESTIONS.md'), 'utf8');
    expect(openQ).toMatch(/fb-4/);
    expect(openQ).toMatch(/bordowy|Red/i);
    expect(openQ).toMatch(/reply in chat/i);

    const fb = await readFile(join(brain.paths.workflowFeedback, 'FEEDBACK.md'), 'utf8');
    expect(fb).toMatch(/fb-1/);
    expect(fb).toMatch(/ASK/);

    const items = JSON.parse(
      await readFile(join(brain.paths.workflowFeedback, 'items.json'), 'utf8'),
    ) as { hasOpenAsks: boolean; items: unknown[] };
    expect(items.hasOpenAsks).toBe(true);
    expect(items.items).toHaveLength(2);
  });

  it('writes artifacts when set_board via writeWorkflowBoard', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neuron-fb-board-'));
    const brain = await openProjectBrain(root, {
      seed: { projectId: 'f2', name: 'f2', stack: ['ts'] },
    });
    const board = emptyBoard('Feedback batch');
    board.phase = 'decompose';
    board.waves = [{ id: 'w1', title: 'Ingest feedback', status: 'pending', tasks: ['parse'] }];
    board.signals = {
      runbook: 'feedback',
      feedbackItems: [{ id: 'fb-6', text: 'joined borders', status: 'pending_triage' }],
    };
    await writeWorkflowBoard(brain, board, { skipValidate: true });
    const fb = await readFile(join(brain.paths.workflowFeedback, 'FEEDBACK.md'), 'utf8');
    expect(fb).toMatch(/fb-6/);
  });
});

import { describe, expect, it } from 'vitest';

import { createWorkflowIntelligence } from '../src/index.js';

describe('session', () => {
  it('starts a technical session with focus', () => {
    const wf = createWorkflowIntelligence();
    const { session, focus } = wf.startSession({
      project: 'shop',
      activeArea: 'Payment module',
      relatedFiles: ['src/payments/RefundService.ts'],
      unfinishedWork: ['Frontend integration'],
      branch: 'feature/refunds',
    });
    expect(session.status).toBe('active');
    expect(focus.allowedModules).toContain('Payment');
    expect(focus.excludedHint).toMatch(/not the entire project/i);
  });
});

describe('resume', () => {
  it('returns last work summary and next steps', () => {
    const wf = createWorkflowIntelligence();
    const task = wf.upsertTask({
      title: 'Implement payment refunds',
      percentComplete: 80,
      completed: ['Database model', 'API endpoint'],
      remaining: ['Frontend integration'],
      relatedDecisions: ['Payment architecture decision'],
    });
    wf.startSession({
      project: 'shop',
      activeArea: 'Payment',
      relatedTasks: [task.id],
      relatedFiles: ['src/payments/RefundService.ts'],
      unfinishedWork: ['Frontend integration'],
      branch: 'feature/refunds',
    });
    const packet = wf.resume();
    expect(packet.lastWorkSummary).toMatch(/Payment/i);
    expect(packet.changedFiles.length).toBeGreaterThan(0);
    expect(packet.nextSuggestedSteps.some((s) => /Frontend/i.test(s))).toBe(true);
    expect(packet.note).toMatch(/Technical resume/i);
  });
});

describe('handoff', () => {
  it('builds current/completed/pending/risks/decisions', () => {
    const wf = createWorkflowIntelligence();
    wf.upsertTask({
      title: 'Implement payment refunds',
      completed: ['Database model', 'API endpoint'],
      remaining: ['Frontend integration'],
      relatedDecisions: ['Payment architecture decision'],
      risks: ['Idempotency on double refund'],
    });
    wf.startSession({
      project: 'shop',
      activeArea: 'Payment',
      unfinishedWork: ['Frontend integration'],
    });
    const handoff = wf.handoff();
    expect(handoff.markdown).toMatch(/Current state/i);
    expect(handoff.pending.some((p) => /Frontend/i.test(p))).toBe(true);
    expect(handoff.importantDecisions.some((d) => /Payment architecture/i.test(d))).toBe(true);
  });
});

describe('task context', () => {
  it('returns technical task memory and breakdown', () => {
    const wf = createWorkflowIntelligence();
    wf.upsertTask({
      title: 'Implement payment refunds',
      percentComplete: 80,
      completed: ['Database model', 'API endpoint'],
      remaining: ['Frontend integration'],
      relatedDecisions: ['Payment architecture decision'],
    });
    const ctx = wf.taskContext('payment refunds');
    expect(ctx.primary?.percentComplete).toBe(80);
    expect(ctx.breakdown.steps[0]!.title).toMatch(/Domain model/i);
    expect(ctx.breakdown.steps.map((s) => s.title).join(',')).toMatch(/Tests/);
  });
});

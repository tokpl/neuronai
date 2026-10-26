import { describe, expect, it } from 'vitest';

import { buildClarifyPlan, detectPlaybook } from '../src/clarify.js';
import type { RetrievalDoc } from '../src/retrieval/rank.js';

function doc(partial: Partial<RetrievalDoc> & Pick<RetrievalDoc, 'id' | 'title' | 'kind'>): RetrievalDoc {
  return {
    content: partial.content ?? partial.title,
    importance: 0.5,
    freshness: 0.5,
    confidence: 0.5,
    ...partial,
  };
}

const richPrefs = {
  schemaVersion: 1,
  project: { id: 'p', name: 'p', stack: ['ts'] },
  privacy: { mode: 'suggest' as const, localOnly: true, telemetry: false },
  memory: { autoSave: true, threshold: 0.7 },
  workflow: { tdd: 'strict' as const },
};

describe('detectPlaybook', () => {
  it('detects ui / docs / polish / maintain', () => {
    expect(detectPlaybook('Polish the landing page hero')).toBe('ui');
    expect(detectPlaybook('Write a README tutorial')).toBe('docs');
    expect(detectPlaybook('Simplify this diff')).toBe('polish');
    expect(detectPlaybook('Upgrade vulnerable dependencies')).toBe('maintain');
    expect(detectPlaybook('Add rate limiting')).toBe('build');
  });
});

describe('buildClarifyPlan', () => {
  it('skips trivial tasks as express', () => {
    const plan = buildClarifyPlan({
      task: 'fix typo in README',
      intent: 'MODIFICATION',
      docs: [],
    });
    expect(plan.questions).toEqual([]);
    expect(plan.gate).toBeNull();
    expect(plan.express).toBe(true);
  });

  it('gates vague builds on a thin Brain with cold-start options', () => {
    const plan = buildClarifyPlan({
      task: 'Add auth',
      intent: 'MODIFICATION',
      docs: [],
    });
    expect(plan.recommendPrime).toBe(true);
    expect(plan.questions.some((q) => q.id === 'prime')).toBe(true);
    expect(plan.questions.some((q) => q.id === 'acceptance')).toBe(true);
    expect(plan.questions.some((q) => q.id === 'risk')).toBe(true);
    expect(plan.gate?.required).toBe(true);
    expect(plan.questions.length).toBeLessThanOrEqual(7);
  });

  it('does not hard-gate Thin Brain when knowledge is rich but map/prefs are missing', () => {
    const docs: RetrievalDoc[] = [
      doc({ id: '1', title: 'Auth middleware', kind: 'decision', content: 'JWT in middleware' }),
      doc({ id: '2', title: 'Rate limit rule', kind: 'rule', content: 'middleware only' }),
      doc({ id: '3', title: 'Session pattern', kind: 'pattern', content: 'httpOnly cookies' }),
    ];
    const plan = buildClarifyPlan({
      task: 'Fix false thin-brain gate when map is empty',
      intent: 'DEBUGGING',
      docs,
      mapEntryCount: 0,
      // no workflow prefs
    });
    expect(plan.recommendPrime).toBe(true);
    expect(plan.questions.some((q) => q.id === 'prime')).toBe(false);
    expect(plan.gate?.until).not.toBe('prime-recommended');
  });

  it('stops re-asking Thin Brain after thinBrainAcknowledgedAt', () => {
    const plan = buildClarifyPlan({
      task: 'Add auth',
      intent: 'MODIFICATION',
      docs: [],
      prefs: {
        ...richPrefs,
        workflow: { ...richPrefs.workflow, thinBrainAcknowledgedAt: '2026-01-01T00:00:00.000Z' },
      },
    });
    expect(plan.questions.some((q) => q.id === 'prime')).toBe(false);
    expect(plan.recommendPrime).toBe(false);
  });

  it('express when Brain is rich and recommendation path is in map docs', () => {
    const docs: RetrievalDoc[] = [
      doc({ id: '1', title: 'Auth middleware', kind: 'decision', content: 'JWT in middleware' }),
      doc({ id: '2', title: 'Rate limit rule', kind: 'rule', content: 'middleware only' }),
      doc({ id: '3', title: 'Session pattern', kind: 'pattern', content: 'httpOnly cookies' }),
      doc({ id: '4', title: 'cache', kind: 'pattern', content: 'redis' }),
      doc({ id: '5', title: 'errors', kind: 'pattern', content: 'NeuronError' }),
      doc({
        id: '6',
        title: 'auth module',
        kind: 'location',
        location: { name: 'auth', path: 'src/auth', kind: 'module' },
      }),
      doc({
        id: '7',
        title: 'middleware',
        kind: 'location',
        location: { name: 'mw', path: 'src/mw.ts', kind: 'file' },
      }),
    ];
    const plan = buildClarifyPlan({
      task: 'Add rate limiting to the public API following middleware decision',
      intent: 'MODIFICATION',
      docs,
      recommendation: {
        path: 'src/mw.ts',
        name: 'middleware',
        reason: 'Brain decision',
      },
      prefs: richPrefs,
      mapEntryCount: 5,
    });
    expect(plan.gate).toBeNull();
    expect(plan.questions).toEqual([]);
    expect(plan.express).toBe(true);
    expect(plan.playbook).toBe('build');
  });

  it('refuses express when recommendation path is not in map docs', () => {
    const docs: RetrievalDoc[] = [
      doc({ id: '1', title: 'Auth middleware', kind: 'decision', content: 'JWT in middleware' }),
      doc({ id: '2', title: 'Rate limit rule', kind: 'rule', content: 'middleware only' }),
      doc({ id: '3', title: 'Session pattern', kind: 'pattern', content: 'httpOnly cookies' }),
      doc({ id: '4', title: 'cache', kind: 'pattern', content: 'redis' }),
      doc({ id: '5', title: 'errors', kind: 'pattern', content: 'NeuronError' }),
      doc({
        id: '6',
        title: 'auth module',
        kind: 'location',
        location: { name: 'auth', path: 'src/auth', kind: 'module' },
      }),
    ];
    const plan = buildClarifyPlan({
      task: 'Add rate limiting to the public API following middleware decision',
      intent: 'MODIFICATION',
      docs,
      recommendation: {
        path: 'src/unknown.ts',
        name: 'unknown',
        reason: 'guess',
      },
      prefs: richPrefs,
      mapEntryCount: 5,
    });
    expect(plan.express).not.toBe(true);
  });

  it('asks playbook for UI-shaped deliver', () => {
    const plan = buildClarifyPlan({
      task: 'Build a new pricing page layout end-to-end',
      intent: 'MODIFICATION',
      docs: [],
      prefs: richPrefs,
      mapEntryCount: 4,
    });
    expect(plan.playbook).toBe('ui');
    expect(plan.questions.some((q) => q.id === 'acceptance' || q.id === 'scope')).toBe(true);
  });
});

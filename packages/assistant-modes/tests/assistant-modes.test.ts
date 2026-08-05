import { describe, expect, it } from 'vitest';

import {
  createAssistantModesEngine,
  createModeRouter,
  createModeContextPlanner,
  createModeExecutor,
  getModeById,
} from '../src/index.js';

describe('mode routing tests', () => {
  it('routes "why is this slow?" to performance', () => {
    const r = createModeRouter().route('why is this slow?');
    expect(r.mode.id).toBe('performance');
  });

  it('routes /architect slash to architect', () => {
    const r = createModeRouter().route('/architect design payments');
    expect(r.mode.id).toBe('architect');
  });

  it('honors explicit modeId', () => {
    const r = createModeRouter().route('anything', 'debug');
    expect(r.mode.id).toBe('debug');
  });
});

describe('context tests', () => {
  it('security mode requires files, dependencies, security_rules', () => {
    const mode = getModeById('security_review')!;
    const ctx = createModeContextPlanner().describe(mode, ['files']);
    expect(ctx.required).toEqual(
      expect.arrayContaining(['files', 'dependencies', 'security_rules']),
    );
    expect(ctx.missing).toEqual(
      expect.arrayContaining(['dependencies', 'security_rules']),
    );
  });
});

describe('output tests', () => {
  it('executor returns standard Summary/Evidence/Findings/Recommendations/Confidence', () => {
    const mode = getModeById('architect')!;
    const out = createModeExecutor().run({
      mode,
      query: 'Design a billing module',
      routeConfidence: 0.9,
    });
    expect(out.summary).toContain('Architect');
    expect(out.evidence.length).toBeGreaterThan(0);
    expect(out.findings.length).toBeGreaterThan(0);
    expect(out.recommendations.length).toBeGreaterThan(0);
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.suggestedTools).toContain('neuron_architecture_review');
  });
});

describe('evaluation tests', () => {
  it('records usefulness and evaluates mode metrics', () => {
    const eng = createAssistantModesEngine();
    eng.runMode({
      query: 'why is this slow?',
      useful: true,
      feedback: 'Found the N+1',
      accuracyHint: 0.9,
    });
    eng.runMode({
      query: 'security review this auth change',
      useful: false,
      accuracyHint: 0.4,
    });
    const evals = eng.usage.evaluate();
    expect(evals.some((e) => e.modeId === 'performance' && e.usefulCount >= 1)).toBe(
      true,
    );
    expect(evals.length).toBeGreaterThan(0);
  });
});

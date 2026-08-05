import { describe, expect, it } from 'vitest';

import {
  createConfidenceCalculator,
  createConflictDetector,
  createDecisionEngine,
  createFeedbackStore,
} from '../src/index.js';

describe('reasoning', () => {
  it('recommends existing PaymentService with evidence', () => {
    const eng = createDecisionEngine();
    const { decision, explanation } = eng.reason({
      request: 'How should I implement refunds?',
      patterns: ['PaymentService used by Checkout', 'PaymentService used by Billing', 'PaymentService used by Admin'],
      codeRefs: ['src/payments/PaymentService.ts'],
      decisions: ['Keep a single payment orchestration service'],
      rules: ['Destructive payment APIs require authz'],
    });
    expect(decision.conclusion).toMatch(/PaymentService/i);
    expect(decision.confidence).toBeGreaterThan(0.5);
    expect(decision.evidence.length).toBeGreaterThan(0);
    expect(explanation).toMatch(/Because:/i);
  });
});

describe('confidence', () => {
  it('rises with stronger evidence weights', () => {
    const calc = createConfidenceCalculator();
    const weak = calc.calculate({
      evidence: [{ kind: 'memory', ref: 'a', detail: 'a', weight: 0.3 }],
    });
    const strong = calc.calculate({
      evidence: [
        { kind: 'decision', ref: 'd', detail: 'ADR', weight: 0.9 },
        { kind: 'rule', ref: 'r', detail: 'rule', weight: 0.95 },
        { kind: 'graph', ref: 'g', detail: 'graph', weight: 0.8 },
      ],
    });
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('conflict', () => {
  it('prefers newer GraphQL over older REST', () => {
    const findings = createConflictDetector().detect({
      request: 'Which API style?',
      decisions: ['Use REST for public API', 'Adopt GraphQL for BFF'],
    });
    expect(findings[0]!.recommendation).toMatch(/GraphQL/i);
    expect(findings[0]!.explanation).toMatch(/conflicting/i);

    const eng = createDecisionEngine();
    const { decision } = eng.reason({
      request: 'Which API style should we use?',
      decisions: ['Use REST for public API', 'Adopt GraphQL for BFF'],
    });
    expect(decision.type).toBe('CONFLICT');
    expect(decision.conclusion).toMatch(/GraphQL/i);
  });
});

describe('feedback', () => {
  it('records helpful/wrong labels for ranking', () => {
    const store = createFeedbackStore();
    store.record({ decisionId: 'dec_1', label: 'HELPFUL' });
    store.record({ decisionId: 'dec_1', label: 'WRONG' });
    expect(store.forDecision('dec_1')).toHaveLength(2);
    expect(store.historicalCorrectness()).toBeLessThan(0.7);

    const eng = createDecisionEngine();
    const { decision } = eng.reason({ request: 'Should I refactor auth?' });
    eng.recordFeedback({ decisionId: decision.id, label: 'PARTIALLY_CORRECT' });
    const evalResult = eng.evaluate(decision.id);
    expect(evalResult.overall).toBeGreaterThanOrEqual(0);
  });
});

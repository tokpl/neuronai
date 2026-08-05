import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createConfidenceCalculator } from '../confidence/calculator.js';
import { createDecisionEvaluator } from '../evaluation/evaluator.js';
import { createFeedbackStore } from '../evaluation/feedback.js';
import { createDecisionExplainer } from '../explanations/explainer.js';
import { listDecisionPolicies } from '../policies/rules.js';
import { createAlternativeAnalyzer } from '../recommendations/alternatives.js';
import { createReasoningEngine } from '../reasoning/engine.js';
import type {
  DecisionFeedback,
  DecisionStoreDocument,
  DecisionTrace,
  FeedbackLabel,
  NeuronDecision,
  OptionPair,
  ReasoningContext,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Decision Engine facade — evidence + recommendation + explanation.
 * Never autonomous code changes; never hidden reasoning.
 */
export class DecisionEngine {
  private decisions: NeuronDecision[] = [];
  private readonly reasoner = createReasoningEngine();
  private readonly confidence = createConfidenceCalculator();
  private readonly explainer = createDecisionExplainer();
  private readonly alternatives = createAlternativeAnalyzer();
  private readonly feedback = createFeedbackStore();
  private readonly evaluator = createDecisionEvaluator();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'decisions-engine.json'), 'utf8'),
      ) as DecisionStoreDocument;
      this.decisions = raw.decisions ?? [];
      this.feedback.load(raw.feedback ?? []);
    } catch {
      this.decisions = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'decisions-engine.json');
    const doc: DecisionStoreDocument = {
      version: 1,
      decisions: this.decisions,
      feedback: this.feedback.list(),
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(doc, null, 2), 'utf8');
    return path;
  }

  policies(): string[] {
    return listDecisionPolicies();
  }

  reason(ctx: ReasoningContext): {
    decision: NeuronDecision;
    explanation: string;
    trace: DecisionTrace;
  } {
    const draft = this.reasoner.reason(ctx);
    const conf = this.confidence.calculate({
      evidence: draft.evidence,
      feedback: this.feedback.list(),
      historicalCorrectness: this.feedback.historicalCorrectness(),
    });

    const decision: NeuronDecision = {
      id: newId('dec'),
      type: draft.type,
      context: ctx.request,
      conclusion: draft.conclusion,
      reasoning: draft.reasoning,
      confidence: conf,
      evidence: draft.evidence,
      impact: draft.impact,
      alternatives: draft.alternatives,
      createdAt: nowIso(),
    };
    this.decisions.unshift(decision);

    const explanation = this.explainer.explain(decision);
    const trace = this.explainer.trace({
      request: ctx.request,
      context: [
        ...(ctx.decisions ?? []).slice(0, 3),
        ...(ctx.rules ?? []).slice(0, 2),
        ...(ctx.graphSummary ? [ctx.graphSummary] : []),
      ],
      evidence: decision.evidence,
      conclusion: decision.conclusion,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    });

    return { decision, explanation, trace };
  }

  recommend(ctx: ReasoningContext) {
    const result = this.reason(ctx);
    return {
      recommendation: result.decision.conclusion,
      confidence: result.decision.confidence,
      evidence: result.decision.evidence,
      risks: [result.decision.impact],
      alternatives: result.decision.alternatives ?? [],
      explanation: result.explanation,
      decision: result.decision,
      trace: result.trace,
      note: 'Advisory recommendation — Neuron does not apply changes.',
    };
  }

  /** Cursor: neuron_decision_context */
  decisionContext(ctx: ReasoningContext) {
    const rec = this.recommend(ctx);
    return {
      recommendation: rec.recommendation,
      evidence: rec.evidence,
      risks: rec.risks,
      alternatives: rec.alternatives,
      confidence: rec.confidence,
      explanation: rec.explanation,
      policies: this.policies(),
      note: rec.note,
    };
  }

  compareOptions(pair: OptionPair, ctx: Omit<ReasoningContext, 'request'> & { request?: string }) {
    const compared = this.alternatives.compare(pair, ctx);
    const wrapped = this.reason({
      request: ctx.request ?? `Compare ${pair.a.name} vs ${pair.b.name}`,
      ...ctx,
      patterns: [
        ...(ctx.patterns ?? []),
        `Recommend ${compared.recommendation}`,
      ],
    });
    return {
      ...compared,
      decision: wrapped.decision,
      explanation: wrapped.explanation,
      confidence: wrapped.decision.confidence,
    };
  }

  explainDecision(decisionId?: string): { explanation: string; decision: NeuronDecision; trace: DecisionTrace } {
    const decision = decisionId
      ? this.decisions.find((d) => d.id === decisionId)
      : this.decisions[0];
    if (!decision) throw new Error('No decision to explain');
    const explanation = this.explainer.explain(decision);
    const trace = this.explainer.trace({
      request: decision.context,
      context: [decision.context],
      evidence: decision.evidence,
      conclusion: decision.conclusion,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    });
    return { explanation, decision, trace };
  }

  recordFeedback(input: {
    decisionId: string;
    label: FeedbackLabel;
    note?: string;
  }): DecisionFeedback {
    return this.feedback.record(input);
  }

  evaluate(decisionId?: string) {
    const decision = decisionId
      ? this.decisions.find((d) => d.id === decisionId)
      : this.decisions[0];
    if (!decision) throw new Error('No decision to evaluate');
    return this.evaluator.evaluate({
      decision,
      feedback: this.feedback.forDecision(decision.id),
    });
  }

  listDecisions(): NeuronDecision[] {
    return [...this.decisions];
  }
}

export function createDecisionEngine(): DecisionEngine {
  return new DecisionEngine();
}

import type { NeuronDecision, DecisionTrace, EvidenceItem } from '../types.js';

/**
 * Always explain why — never "just do X".
 */
export class DecisionExplainer {
  explain(decision: NeuronDecision): string {
    const lines = [
      `I recommend: ${decision.conclusion}`,
      '',
      'Because:',
      ...decision.reasoning.map((r, i) => `${i + 1}. ${r}`),
      '',
      `Confidence: ${Math.round(decision.confidence * 100)}%`,
      '',
      'Evidence:',
      ...decision.evidence.slice(0, 8).map((e) => `- [${e.kind}] ${e.ref}: ${e.detail.slice(0, 120)}`),
      '',
      `Impact: ${decision.impact}`,
      '',
      '_Advisory only — Neuron does not change code autonomously._',
    ];
    return lines.join('\n');
  }

  trace(input: {
    request: string;
    context: string[];
    evidence: EvidenceItem[];
    conclusion: string;
    confidence: number;
    reasoning: string[];
  }): DecisionTrace {
    return {
      input: input.request,
      context: input.context,
      evidence: input.evidence,
      conclusion: input.conclusion,
      confidence: input.confidence,
      steps: [
        'Input received',
        `Context gathered (${input.context.length} signals)`,
        `Evidence collected (${input.evidence.length} items)`,
        ...input.reasoning.map((r) => `Reason: ${r}`),
        `Conclusion: ${input.conclusion}`,
      ],
    };
  }
}

export function createDecisionExplainer(): DecisionExplainer {
  return new DecisionExplainer();
}

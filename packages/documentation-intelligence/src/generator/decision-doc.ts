import type { DecisionDocInput, DocumentationArtifact } from '../types.js';
import { newId, nowIso } from '../types.js';
import { decisionTemplate } from '../templates/decision.js';

export class DecisionDocGenerator {
  generate(input: DecisionDocInput): DocumentationArtifact {
    const slug = input.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      id: newId('doc'),
      type: 'DECISION_DOC',
      source: 'generated',
      path: `.neuron/docs/decisions/${slug}.md`,
      title: input.title,
      content: decisionTemplate(input),
      generatedFrom: ['architecture_decision'],
      lastUpdated: nowIso(),
      confidence: 0.85,
      status: 'CURRENT',
    };
  }

  generateMany(decisions: DecisionDocInput[]): DocumentationArtifact[] {
    return decisions.map((d) => this.generate(d));
  }

  /** Sync helper: map free-text decisions into ADR-like docs */
  fromTexts(texts: string[]): DocumentationArtifact[] {
    return texts.map((t, i) => {
      const title = t.split(/[.\n]/)[0]?.trim() || `Decision ${i + 1}`;
      return this.generate({
        id: `ADR-${String(i + 1).padStart(3, '0')}`,
        title,
        why: t,
        decision: title,
        alternatives: [],
        status: 'Accepted',
      });
    });
  }
}

export function createDecisionDocGenerator(): DecisionDocGenerator {
  return new DecisionDocGenerator();
}

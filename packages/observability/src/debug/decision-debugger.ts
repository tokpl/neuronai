import { filterTraceText } from '../tracing/filters.js';
import type { DecisionDebugSnapshot } from '../tracing/types.js';

export interface DecisionDebuggerInput {
  recommendation: string;
  evidence: string[];
  confidence: number;
  modules?: number;
}

export class DecisionDebugger {
  snapshot(input: DecisionDebuggerInput): DecisionDebugSnapshot {
    return {
      recommendation: filterTraceText(input.recommendation, 300),
      evidence: input.evidence.map((e) => filterTraceText(e, 200)).slice(0, 20),
      confidence: Math.max(0, Math.min(1, input.confidence)),
      modules: input.modules,
    };
  }

  format(snap: DecisionDebugSnapshot): string {
    const lines = [
      'Recommendation:',
      snap.recommendation,
      '',
      'Evidence:',
      snap.modules !== undefined ? `${snap.modules} modules` : snap.evidence[0] ?? '(none)',
      ...snap.evidence.map((e) => `- ${e}`),
      '',
      'Confidence:',
      `${Math.round(snap.confidence * 100)}%`,
    ];
    return lines.join('\n');
  }
}

export function createDecisionDebugger(): DecisionDebugger {
  return new DecisionDebugger();
}

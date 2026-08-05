import type { AgentContext } from '../context/context-engine.js';
import type { ChangeRiskReport } from '../risk/change-risk-analyzer.js';
import type { ArchitectureReview } from '../review/architecture-reviewer.js';

export interface AgentRecommendations {
  items: string[];
  risks: string[];
  nextActions: string[];
}

export function buildRecommendations(input: {
  context?: AgentContext;
  risk?: ChangeRiskReport;
  review?: ArchitectureReview;
}): AgentRecommendations {
  const items: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  for (const d of input.context?.decisions.slice(0, 5) ?? []) {
    items.push(`Respect decision: ${d.title}`);
  }
  for (const w of input.context?.warnings.slice(0, 5) ?? []) {
    items.push(`Heed warning: ${w}`);
    risks.push(w);
  }
  if (input.risk) {
    risks.push(`${input.risk.level}: ${input.risk.reasons[0] ?? input.risk.change}`);
    nextActions.push('Mitigate listed blast-radius modules before coding');
  }
  if (input.review) {
    for (const r of input.review.recommendations.slice(0, 5)) items.push(r);
    nextActions.push('Address architecture review issues, then re-check');
  }
  if (!nextActions.length) {
    nextActions.push('Call neuron_prepare_task before large changes');
  }

  return {
    items: [...new Set(items)],
    risks: [...new Set(risks)],
    nextActions: [...new Set(nextActions)],
  };
}

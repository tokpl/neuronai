/**
 * Soft policies for the decision engine (not autonomous agents).
 */
export const DECISION_POLICIES = [
  'Never apply code changes autonomously — recommendations only.',
  'Never hide reasoning — always return evidence + explanation.',
  'Conflicts: prefer newer explicit decisions unless CRITICAL constitution rules forbid.',
  'Low evidence ⇒ WARNING / ask for more context, not a fake high-confidence answer.',
] as const;

export function listDecisionPolicies(): string[] {
  return [...DECISION_POLICIES];
}

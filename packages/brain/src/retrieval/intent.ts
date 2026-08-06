/**
 * What the developer is asking for. Deterministic pattern matching, no model.
 *
 * Intent only nudges ranking toward the right *kind* of knowledge — it never
 * decides relevance on its own.
 */
export type QueryIntent =
  | 'LOCATION'
  | 'MODIFICATION'
  | 'ARCHITECTURE'
  | 'CONVENTION'
  | 'DECISION'
  | 'IMPLEMENTATION'
  | 'DEBUGGING'
  | 'DEPENDENCY'
  | 'IMPACT'
  | 'CONFIGURATION'
  | 'GENERAL_PROJECT';

interface IntentRule {
  intent: QueryIntent;
  pattern: RegExp;
}

// Order matters: the first match wins, so specific phrasings come first.
const RULES: IntentRule[] = [
  { intent: 'DEBUGGING', pattern: /\b(bug|broken|failing|fails|error|crash|regression|debug|why is .* not)\b/i },
  {
    intent: 'IMPACT',
    pattern:
      /\b(what (files? )?(would|will|do) i (likely )?need to (change|touch|inspect)|blast radius|what (is )?affected|if i (change|modify|edit)|files? (would|will) .* change|what else should i (inspect|check|look))\b/i,
  },
  {
    intent: 'DEPENDENCY',
    pattern:
      /\b(what calls|who (calls|uses)|what does .* (call|depend)|depends? on|dependents?|dependency|dependencies|used by|callers? of)\b/i,
  },
  {
    intent: 'MODIFICATION',
    pattern:
      /\b(where should (i|we)|which file should|where (does|do|to) .* belong|where (to|do i|do we) (add|put|place|modify|change|implement)|recommended (location|file|place)|add (a |an |the )?(new )?(endpoint|route|handler|test|feature)|add support for|implement (support for )?\w+|where (do|should) (i|we) (put|add|place))\b/i,
  },
  {
    intent: 'CONVENTION',
    pattern:
      /\b(convention|conventions|standard|standards|style guide|best practice|do we always|naming|what rule|which rule|what (should|must) i avoid|what constraint)\b/i,
  },
  { intent: 'DECISION', pattern: /\b(why (do|did|does|are|is)|rationale|decided|decision|trade-?off|instead of)\b/i },
  { intent: 'CONFIGURATION', pattern: /\b(config|configured|configure|configuration|env var|environment variable|settings?|\.env)\b/i },
  { intent: 'LOCATION', pattern: /\b(where|which file|which module|what file|locate|located|find the|path to)\b/i },
  { intent: 'ARCHITECTURE', pattern: /\b(architecture|architectural|structure|structured|layers?|design of|overall|high[- ]level|how is .* organi[sz]ed)\b/i },
  { intent: 'IMPLEMENTATION', pattern: /\b(how (does|do|is|are)|implemented|implementation|works?|flow of|what happens when)\b/i },
];

export function classifyIntent(query: string): QueryIntent {
  for (const rule of RULES) {
    if (rule.pattern.test(query)) return rule.intent;
  }
  return 'GENERAL_PROJECT';
}

/**
 * Per-intent preference for a result kind, as a small additive bonus.
 * Capped low on purpose: intent breaks ties, it does not override matching.
 */
const AFFINITY: Record<QueryIntent, Partial<Record<string, number>>> = {
  LOCATION: { location: 0.3, knowledge: 0.05 },
  MODIFICATION: { location: 0.28, rule: 0.2, pattern: 0.12, decision: 0.08 },
  ARCHITECTURE: { decision: 0.15, location: 0.12, pattern: 0.08 },
  CONVENTION: { rule: 0.25, pattern: 0.2 },
  DECISION: { decision: 0.25, rule: 0.1 },
  IMPLEMENTATION: { location: 0.18, pattern: 0.12, knowledge: 0.08 },
  DEBUGGING: { warning: 0.3, location: 0.1 },
  DEPENDENCY: { location: 0.28, knowledge: 0.12 },
  IMPACT: { location: 0.3, knowledge: 0.1 },
  CONFIGURATION: { location: 0.25, knowledge: 0.1 },
  GENERAL_PROJECT: {},
};

export function intentAffinity(intent: QueryIntent, kind: string): number {
  return AFFINITY[intent][kind] ?? 0;
}

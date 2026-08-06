/** Preparation depth for Brain → Prompt compilation. */
export type PreparationMode = 'minimal' | 'standard' | 'deep';

/** Soft token budgets (semantic density first; never exceed unless forced). */
export const PREPARATION_TOKEN_BUDGETS: Record<PreparationMode, number> = {
  minimal: 500,
  standard: 1200,
  deep: 3500,
};

export interface PreparationModeResolved {
  mode: PreparationMode;
  tokenBudget: number;
  /** Verbose internal dump for developers only */
  debug: boolean;
  /** How many ranked items to retrieve before compression */
  retrieveLimit: number;
  includeHints: boolean;
  includePlan: boolean;
  includeRisks: boolean;
}

/**
 * Map MCP / agent mode strings → preparation profile.
 * Default is **minimal** (everyday coding).
 */
export function resolvePreparationMode(
  value?: string,
  env: NodeJS.ProcessEnv = process.env,
): PreparationModeResolved {
  const debugEnv = env['NEURON_DEBUG'] === '1' || env['NEURON_DEBUG'] === 'true';
  const debugFlag = value === 'debug' || debugEnv;

  let mode: PreparationMode = 'minimal';
  if (value === 'standard') mode = 'standard';
  else if (value === 'architect' || value === 'deep') mode = 'deep';
  else if (value === 'fast' || value === 'minimal' || value === undefined || value === '') {
    mode = 'minimal';
  } else if (value === 'debug') {
    mode = 'deep';
  }

  if (debugFlag && mode === 'minimal') {
    // debug with no explicit deep still expands retrieval but stays explainable
    mode = 'standard';
  }

  return {
    mode,
    tokenBudget: PREPARATION_TOKEN_BUDGETS[mode],
    debug: debugFlag,
    retrieveLimit: mode === 'minimal' ? 8 : mode === 'standard' ? 16 : 28,
    includeHints: mode !== 'minimal',
    includePlan: mode === 'deep',
    includeRisks: mode === 'deep',
  };
}

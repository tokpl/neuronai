/**
 * Privacy modes for automatic agent workflow.
 *
 * - manual: never auto-suggest/auto-save from workflow (agent must call tools explicitly)
 * - suggest: create suggestions for the user/agent (default)
 * - automatic: auto-save high-confidence suggestions that pass quality checks
 */
export type PrivacyMode = 'manual' | 'suggest' | 'automatic';

export const DEFAULT_PRIVACY_MODE: PrivacyMode = 'suggest';

export function parsePrivacyMode(value: unknown): PrivacyMode {
  if (value === 'manual' || value === 'suggest' || value === 'automatic') return value;
  return DEFAULT_PRIVACY_MODE;
}

export interface PrivacyPolicy {
  mode: PrivacyMode;
  /** Confidence required for automatic mode to persist */
  autoSaveMinConfidence: number;
}

export function createPrivacyPolicy(
  mode: PrivacyMode = DEFAULT_PRIVACY_MODE,
  autoSaveMinConfidence = 0.8,
): PrivacyPolicy {
  return { mode, autoSaveMinConfidence };
}

export function shouldEmitSuggestion(policy: PrivacyPolicy): boolean {
  return policy.mode === 'suggest' || policy.mode === 'automatic';
}

export function shouldAutoPersist(
  policy: PrivacyPolicy,
  confidence: number,
  qualityOk: boolean,
): boolean {
  return (
    policy.mode === 'automatic' && qualityOk && confidence >= policy.autoSaveMinConfidence
  );
}

/**
 * Telemetry / error reporting must be opt-in.
 */
export interface PrivacyConsent {
  /** Allow anonymous usage metrics */
  metrics: boolean;
  /** Allow error reports (scrubbed) */
  errorReporting: boolean;
  /** Allow any cloud sync (future) */
  cloudSync: boolean;
}

export const DEFAULT_PRIVACY_CONSENT: PrivacyConsent = {
  metrics: false,
  errorReporting: false,
  cloudSync: false,
};

export function parsePrivacyConsent(raw: unknown): PrivacyConsent {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PRIVACY_CONSENT };
  const o = raw as Record<string, unknown>;
  return {
    metrics: o['metrics'] === true,
    errorReporting: o['errorReporting'] === true,
    cloudSync: o['cloudSync'] === true,
  };
}

export function canSendTelemetry(
  consent: PrivacyConsent,
  kind: 'metrics' | 'errorReporting',
): boolean {
  return consent[kind] === true;
}

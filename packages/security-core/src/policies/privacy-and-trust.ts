import type { PrivacyMode, TrustLevel } from '../types.js';
import { defaultSecurityContext } from '../types.js';

export class PrivacyPolicy {
  resolve(mode?: PrivacyMode): PrivacyMode {
    return mode ?? 'LOCAL_ONLY';
  }

  allowsCloud(mode: PrivacyMode): boolean {
    return mode === 'CLOUD_ALLOWED' || mode === 'HYBRID';
  }
}

export class TrustPolicy {
  rank(level: TrustLevel): number {
    switch (level) {
      case 'UNKNOWN':
        return 0;
      case 'LIMITED':
        return 1;
      case 'TRUSTED':
        return 2;
      case 'VERIFIED':
        return 3;
    }
  }

  atLeast(actual: TrustLevel, required: TrustLevel): boolean {
    return this.rank(actual) >= this.rank(required);
  }
}

export function createDefaultPolicies(project?: string) {
  return defaultSecurityContext(project);
}

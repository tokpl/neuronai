import { createPromptInjectionDetector } from '../policies/prompt-injection.js';
import { createSourceTrustAnalyzer } from '../policies/source-trust.js';
import { TrustPolicy } from '../policies/privacy-and-trust.js';
import type { MemorySecurityDecision, TrustLevel } from '../types.js';

export interface MemoryCandidate {
  title: string;
  content: string;
  sourcePath?: string;
  sourceTrust?: TrustLevel;
  daysSinceChange?: number;
}

const POISON_PATTERNS: RegExp[] = [
  /disable\s+authentication/i,
  /remove\s+all\s+(auth|security)/i,
  /always\s+trust\s+external\s+input/i,
  /store\s+passwords?\s+in\s+plaintext/i,
  /skip\s+(authorization|permission)\s+checks?/i,
];

/**
 * Protect memory from poisoning / malicious knowledge injection.
 */
export class MemorySecurityManager {
  private readonly injection = createPromptInjectionDetector();
  private readonly trust = createSourceTrustAnalyzer();
  private readonly trustPolicy = new TrustPolicy();

  evaluate(candidate: MemoryCandidate): MemorySecurityDecision {
    const title = candidate.title;
    const blob = `${candidate.title}\n${candidate.content}`;

    for (const re of POISON_PATTERNS) {
      if (re.test(blob)) {
        const sourceTrust =
          candidate.sourceTrust ??
          (candidate.sourcePath
            ? this.trust.assess({
                path: candidate.sourcePath,
                daysSinceChange: candidate.daysSinceChange,
              }).trustLevel
            : 'UNKNOWN');

        return {
          accepted: false,
          reason:
            sourceTrust === 'UNKNOWN' || sourceTrust === 'LIMITED'
              ? `Rejected: "${title}" from untrusted source (${sourceTrust})`
              : 'Rejected memory that disables security controls',
          trustLevel: sourceTrust,
          title,
        };
      }
    }

    const injections = this.injection.analyze(blob, candidate.sourcePath ?? 'memory');
    if (injections.some((i) => i.severity === 'high')) {
      return {
        accepted: false,
        reason: `Rejected memory with prompt-injection pattern: ${injections[0]!.pattern}`,
        trustLevel: candidate.sourceTrust ?? 'UNKNOWN',
        title,
      };
    }

    const report = candidate.sourcePath
      ? this.trust.assess({
          path: candidate.sourcePath,
          daysSinceChange: candidate.daysSinceChange,
        })
      : undefined;

    return {
      accepted: true,
      reason: 'Memory accepted under security policy',
      trustLevel: candidate.sourceTrust ?? report?.trustLevel ?? 'LIMITED',
      title,
    };
  }
}

export function createMemorySecurityManager(): MemorySecurityManager {
  return new MemorySecurityManager();
}

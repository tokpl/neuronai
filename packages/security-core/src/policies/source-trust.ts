import type { SourceTrustReport, TrustLevel } from '../types.js';

export interface SourceTrustInput {
  path: string;
  /** Days since last change; undefined = unknown */
  daysSinceChange?: number;
  author?: string;
  /** e.g. dependency, generated, vendor */
  locationKind?: 'src' | 'docs' | 'vendor' | 'generated' | 'root' | 'unknown';
  gitUntracked?: boolean;
  fromDependency?: boolean;
}

/**
 * Assess trust of a file source (README changed yesterday → LOW / LIMITED).
 */
export class SourceTrustAnalyzer {
  assess(input: SourceTrustInput): SourceTrustReport {
    const reasons: string[] = [];
    let score = 70;
    const path = input.path.replace(/\\/g, '/');
    const base = path.split('/').pop() ?? path;

    if (input.gitUntracked) {
      score -= 25;
      reasons.push('File is untracked in git');
    }
    if (input.fromDependency || input.locationKind === 'vendor') {
      score -= 20;
      reasons.push('Vendor / dependency source');
    }
    if (input.locationKind === 'generated') {
      score -= 15;
      reasons.push('Generated artifact');
    }
    if (/^readme/i.test(base) || /\.md$/i.test(base)) {
      if (input.daysSinceChange !== undefined && input.daysSinceChange <= 1) {
        score -= 30;
        reasons.push('README/docs changed within 1 day — LOW TRUST');
      } else if (input.daysSinceChange !== undefined && input.daysSinceChange <= 7) {
        score -= 15;
        reasons.push('Recently edited documentation');
      }
    }
    if (input.daysSinceChange === undefined) {
      score -= 10;
      reasons.push('Change history unknown');
    }
    if (!input.author) {
      score -= 5;
      reasons.push('Author unknown');
    }
    if (input.locationKind === 'src' && input.daysSinceChange !== undefined && input.daysSinceChange > 30) {
      score += 10;
      reasons.push('Stable source file');
    }

    score = Math.max(0, Math.min(100, score));
    const trustLevel = scoreToTrust(score);
    if (!reasons.length) reasons.push('Default project trust');

    return { path, trustLevel, reasons, score };
  }
}

function scoreToTrust(score: number): TrustLevel {
  if (score >= 85) return 'VERIFIED';
  if (score >= 65) return 'TRUSTED';
  if (score >= 40) return 'LIMITED';
  return 'UNKNOWN';
}

export function createSourceTrustAnalyzer(): SourceTrustAnalyzer {
  return new SourceTrustAnalyzer();
}

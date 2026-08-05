import type { ChangeImportance } from '../types.js';

/**
 * Skip noisy saves — classify change importance.
 */
export class ChangeImportanceAnalyzer {
  classify(path: string, detail?: string): ChangeImportance {
    const p = path.replace(/\\/g, '/').toLowerCase();
    const d = (detail ?? '').toLowerCase();

    if (/\.env|credential|secret|private.?key/.test(p)) return 'CRITICAL';
    if (
      /schema\.prisma|migration|docker-compose|package\.json|composer\.json|go\.mod|cargo\.toml/.test(
        p,
      )
    ) {
      return 'HIGH';
    }
    if (/auth|payment|permission|security|database|repository|service/i.test(p)) return 'HIGH';
    if (/controller|route|api|module/i.test(p)) return 'MEDIUM';
    if (/readme|\.md$|changelog|typo|comment|css|svg|lock$/i.test(p)) return 'LOW';
    if (/typo|whitespace|format/i.test(d)) return 'LOW';
    return 'MEDIUM';
  }
}

export function createChangeImportanceAnalyzer(): ChangeImportanceAnalyzer {
  return new ChangeImportanceAnalyzer();
}

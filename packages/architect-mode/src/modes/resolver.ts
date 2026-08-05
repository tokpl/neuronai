import type { ArchitectModeKind } from '../types.js';

/**
 * Resolve architect workflow mode. Never generates code.
 */
export class ArchitectModeResolver {
  resolve(raw?: string, request?: string): ArchitectModeKind {
    const t = `${raw ?? ''} ${request ?? ''}`.toLowerCase();
    if (/\breview\b|ocena|review implementation/.test(t)) return 'REVIEW';
    if (/\bdebug\b|root cause|memory leak|investigate/.test(t)) return 'DEBUG';
    if (
      /\barchitect\b|design |marketplace|payment system|migrat|refactor|create .* system|pełn/.test(
        t,
      )
    ) {
      return 'ARCHITECT';
    }
    if (raw) {
      const u = raw.toUpperCase();
      if (u === 'NORMAL' || u === 'ARCHITECT' || u === 'REVIEW' || u === 'DEBUG') return u;
    }
    // Major feature heuristics → ARCHITECT
    if (
      request &&
      /\b(add|create|build|implement|design)\b/i.test(request) &&
      /\b(system|platform|marketplace|payment|auth|billing)\b/i.test(request)
    ) {
      return 'ARCHITECT';
    }
    return 'NORMAL';
  }

  /** Small fixes should not force full architect analysis */
  isMajorFeature(request: string): boolean {
    const t = request.toLowerCase();
    if (/\b(typo|rename|whitespace|comment|css|readme)\b/.test(t)) return false;
    if (/\b(fix|hotfix|patch)\b/.test(t) && !/\b(system|architecture|migrat)\b/.test(t)) {
      return false;
    }
    return this.resolve('ARCHITECT', request) === 'ARCHITECT' ||
      (/\b(add|create|implement|design|build)\b/.test(t) &&
        /\b(module|service|system|payment|auth|marketplace)\b/.test(t));
  }
}

export function createArchitectModeResolver(): ArchitectModeResolver {
  return new ArchitectModeResolver();
}

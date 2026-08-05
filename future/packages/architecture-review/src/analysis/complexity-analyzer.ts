import type { ComplexityFinding } from '../types.js';

export interface ComplexityInput {
  /** Path or symbol */
  location: string;
  /** Full file or function source (optional) */
  source?: string;
  /** Precomputed metrics */
  loc?: number;
  functionLoc?: number;
  nestingDepth?: number;
  duplicateHash?: string;
}

/**
 * Measures large files/functions, deep nesting, duplicate logic hints.
 */
export class ComplexityAnalyzer {
  private seenHashes = new Map<string, string>();

  analyze(inputs: ComplexityInput[]): ComplexityFinding[] {
    const findings: ComplexityFinding[] = [];

    for (const input of inputs) {
      const loc = input.loc ?? (input.source ? input.source.split(/\r?\n/).length : 0);
      if (loc >= 400) {
        findings.push({
          location: input.location,
          kind: 'large_file',
          metric: loc,
          detail: `Large file (~${loc} LOC) — consider splitting.`,
        });
      }

      const fnLoc =
        input.functionLoc ??
        (input.source ? estimateLargestFunction(input.source) : 0);
      if (fnLoc >= 80) {
        findings.push({
          location: input.location,
          kind: 'large_function',
          metric: fnLoc,
          detail: `Large function (~${fnLoc} lines) — extract helpers.`,
        });
      }

      const nesting =
        input.nestingDepth ?? (input.source ? estimateNesting(input.source) : 0);
      if (nesting >= 5) {
        findings.push({
          location: input.location,
          kind: 'deep_nesting',
          metric: nesting,
          detail: `Deep nesting (depth ${nesting}) — flatten control flow.`,
        });
      }

      const hash = input.duplicateHash ?? (input.source ? simpleHash(input.source) : '');
      if (hash && this.seenHashes.has(hash)) {
        findings.push({
          location: input.location,
          kind: 'duplicate_logic',
          metric: 1,
          detail: `Possible duplicate of ${this.seenHashes.get(hash)}`,
        });
      } else if (hash && input.source && input.source.length > 200) {
        this.seenHashes.set(hash, input.location);
      }
    }

    return findings;
  }

  reset(): void {
    this.seenHashes.clear();
  }
}

function estimateLargestFunction(source: string): number {
  const lines = source.split(/\r?\n/);
  let max = 0;
  let depth = 0;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const open = (line.match(/{/g) ?? []).length;
    const close = (line.match(/}/g) ?? []).length;
    if (depth === 0 && /function\b|=>\s*{|\bclass\b/.test(line) && open > 0) {
      start = i;
    }
    depth += open - close;
    if (depth === 0 && start >= 0) {
      max = Math.max(max, i - start + 1);
      start = -1;
    }
  }
  return max;
}

function estimateNesting(source: string): number {
  let depth = 0;
  let max = 0;
  for (const ch of source) {
    if (ch === '{') {
      depth++;
      max = Math.max(max, depth);
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

function simpleHash(s: string): string {
  const normalized = s.replace(/\s+/g, ' ').trim().slice(0, 500);
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `h${h}`;
}

export function createComplexityAnalyzer(): ComplexityAnalyzer {
  return new ComplexityAnalyzer();
}

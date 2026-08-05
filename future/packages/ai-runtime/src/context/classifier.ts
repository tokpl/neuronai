import type { DataClassification } from '../types.js';

/**
 * Classifies context by path + content heuristics.
 * Example: README → PUBLIC, .env → CRITICAL.
 */
export class ContextClassifier {
  classify(pathHint?: string, text = ''): DataClassification {
    const path = (pathHint ?? '').replace(/\\/g, '/').toLowerCase();
    const blob = text.toLowerCase();

    if (
      /(^|\/)\.env(\.|$)/.test(path) ||
      /\.pem$|\.key$|id_rsa|credentials\.json|secrets?\./.test(path) ||
      /begin (rsa )?private key/.test(blob)
    ) {
      return 'CRITICAL';
    }

    if (
      /(^|\/)(auth|security|payment|billing)\//.test(path) ||
      /\b(password|api[_-]?key|secret|token)\b\s*[:=]/.test(blob)
    ) {
      return 'SENSITIVE';
    }

    if (
      /(^|\/)(src|apps|packages|lib|internal)\//.test(path) ||
      /\b(proprietary|internal only|do not share)\b/.test(blob)
    ) {
      return 'INTERNAL';
    }

    if (
      /readme|changelog|license|docs\/|contributing/i.test(path) ||
      path.endsWith('.md')
    ) {
      return 'PUBLIC';
    }

    if (!path && blob.length < 40) return 'PUBLIC';
    return 'INTERNAL';
  }
}

export function createContextClassifier(): ContextClassifier {
  return new ContextClassifier();
}

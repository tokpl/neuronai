import type { ChangeType } from './types.js';

/**
 * Classify change from commit message + paths.
 */
export class ChangeClassifier {
  classify(input: { message: string; files?: string[] }): ChangeType {
    const msg = input.message.toLowerCase();
    const files = (input.files ?? []).join(' ').toLowerCase();
    const blob = `${msg} ${files}`;

    if (/\b(security|secure|cve|xss|csrf|authn|authz|secret|vulnerab)/i.test(blob)) {
      return 'SECURITY';
    }
    if (/\b(perf|latency|slow|optim|cache|n\+1|throughput)\b/.test(blob)) {
      return 'PERFORMANCE';
    }
    if (
      /\b(architect|migrate\s+to|rewrite|replace\s+rest|graphql|event.?driven)\b/.test(blob) ||
      /\b(breaking\s+change)\b/.test(msg)
    ) {
      return 'ARCHITECTURE';
    }
    if (/\b(refactor|cleanup|rename|extract|split\s+module)\b/.test(blob)) {
      return 'REFACTOR';
    }
    if (/\b(fix|bug|hotfix|patch|regression)\b/.test(msg) || /^fix(\(|:)/i.test(msg)) {
      return 'BUGFIX';
    }
    if (/\b(docs?|readme|changelog|guide)\b/.test(blob) || /\.md$/i.test(files)) {
      return 'DOCUMENTATION';
    }
    if (/\b(feat|feature|add\b|implement)\b/.test(msg) || /^feat(\(|:)/i.test(msg)) {
      return 'FEATURE';
    }
    return 'FEATURE';
  }
}

export function createChangeClassifier(): ChangeClassifier {
  return new ChangeClassifier();
}

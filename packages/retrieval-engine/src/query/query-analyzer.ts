import type { AnalyzedQuery, RiskLevel, TaskIntent } from '../types.js';

const DOMAIN_LEXICON: Record<string, string[]> = {
  payments: ['payment', 'refund', 'stripe', 'billing', 'invoice', 'checkout'],
  transactions: ['transaction', 'ledger', 'outbox', 'idempot'],
  database: ['postgres', 'mysql', 'sql', 'migration', 'schema', 'db'],
  users: ['user', 'auth', 'rbac', 'permission', 'session', 'jwt'],
  notifications: ['notify', 'email', 'push', 'webhook', 'event'],
  frontend: ['react', 'component', 'ui', 'css', 'zustand', 'redux'],
  architecture: ['architect', 'refactor', 'migrate', 'rewrite', 'module'],
};

/**
 * Understand task intent, domains, related areas, and risk - no LLM required.
 */
export class QueryAnalyzer {
  analyze(task: string): AnalyzedQuery {
    const raw = task.trim();
    const lower = raw.toLowerCase();
    const keywords = tokenize(lower);

    const intent = detectIntent(lower);
    const domains = detectDomains(lower);
    const related = inferRelated(domains, lower);
    const risk = detectRisk(lower, intent, domains);
    const complexity = detectComplexity(intent, risk, domains.length);

    return {
      raw,
      intent,
      domains,
      related,
      keywords,
      risk,
      complexity,
    };
  }
}

function detectIntent(t: string): TaskIntent {
  if (/\b(refund|add|implement|feature|build|create)\b/.test(t)) return 'FEATURE';
  if (/\b(fix|bug|hotfix|patch|broken)\b/.test(t)) return 'BUGFIX';
  if (/\b(refactor|extract|rename|cleanup|split)\b/.test(t)) return 'REFACTOR';
  if (/\b(architect|redesign|migrate|rewrite)\b/.test(t)) return 'ARCHITECTURE';
  if (/\b(debug|trace|investigate|why|root cause)\b/.test(t)) return 'DEBUG';
  if (/\b(doc|readme|comment)\b/.test(t)) return 'DOCS';
  return 'UNKNOWN';
}

function detectDomains(t: string): string[] {
  const found: string[] = [];
  for (const [domain, words] of Object.entries(DOMAIN_LEXICON)) {
    if (words.some((w) => t.includes(w))) found.push(domain);
  }
  return found.length ? found : ['general'];
}

function inferRelated(domains: string[], t: string): string[] {
  const related = new Set<string>();
  if (domains.includes('payments')) {
    related.add('transactions');
    related.add('database');
    related.add('users');
    if (/notif|email|receipt/.test(t)) related.add('notifications');
  }
  if (domains.includes('users')) related.add('database');
  if (domains.includes('architecture')) {
    related.add('database');
    related.add('frontend');
  }
  for (const d of domains) related.delete(d);
  return [...related];
}

function detectRisk(t: string, intent: TaskIntent, domains: string[]): RiskLevel {
  if (
    intent === 'ARCHITECTURE' ||
    domains.includes('payments') ||
    domains.includes('users') ||
    /\b(security|permission|migrate|payment|auth)\b/.test(t)
  ) {
    return 'HIGH';
  }
  if (intent === 'REFACTOR' || intent === 'FEATURE') return 'MEDIUM';
  return 'LOW';
}

function detectComplexity(
  intent: TaskIntent,
  risk: RiskLevel,
  domainCount: number,
): AnalyzedQuery['complexity'] {
  if (intent === 'ARCHITECTURE' || (risk === 'HIGH' && domainCount >= 3)) return 'architecture';
  if (intent === 'REFACTOR' || domainCount >= 2) return 'large';
  if (intent === 'BUGFIX' || intent === 'DOCS') return 'small';
  return 'standard';
}

function tokenize(text: string): string[] {
  return text
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
    .slice(0, 40);
}

export function createQueryAnalyzer(): QueryAnalyzer {
  return new QueryAnalyzer();
}

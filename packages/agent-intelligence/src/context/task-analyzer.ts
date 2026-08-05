export type TaskType =
  | 'FEATURE'
  | 'BUGFIX'
  | 'REFACTOR'
  | 'MIGRATION'
  | 'DOCS'
  | 'INFRA'
  | 'UNKNOWN';

export interface AnalyzedTask {
  raw: string;
  type: TaskType;
  affectedAreas: string[];
  keywords: string[];
  intents: string[];
}

const AREA_LEXICON: Array<{ area: string; patterns: RegExp[] }> = [
  { area: 'auth', patterns: [/auth/i, /login/i, /jwt/i, /session/i, /oauth/i] },
  { area: 'permissions', patterns: [/permission/i, /rbac/i, /acl/i, /role/i] },
  { area: 'vehicles', patterns: [/vehicle/i, /car/i, /fleet/i] },
  { area: 'economy', patterns: [/econom/i, /market/i, /trade/i, /payment/i, /billing/i, /wallet/i] },
  { area: 'database', patterns: [/database/i, /schema/i, /migration/i, /sql/i, /prisma/i, /drizzle/i] },
  { area: 'api', patterns: [/api/i, /endpoint/i, /gateway/i, /rest/i, /graphql/i] },
  { area: 'ui', patterns: [/ui\b/i, /frontend/i, /react/i, /next/i, /component/i] },
  { area: 'admin', patterns: [/admin/i, /dashboard/i] },
  { area: 'factions', patterns: [/faction/i, /guild/i, /clan/i] },
];

/**
 * Understands a natural-language coding task without calling an LLM.
 */
export class TaskAnalyzer {
  analyze(task: string): AnalyzedTask {
    const raw = task.trim();
    const lower = raw.toLowerCase();

    let type: TaskType = 'UNKNOWN';
    if (/\b(fix|bug|hotfix|patch)\b/i.test(raw)) type = 'BUGFIX';
    else if (/\b(refactor|rewrite|cleanup)\b/i.test(raw)) type = 'REFACTOR';
    else if (/\b(migrat|schema|database)\b/i.test(raw)) type = 'MIGRATION';
    else if (/\b(doc|readme|guide)\b/i.test(raw)) type = 'DOCS';
    else if (/\b(docker|ci|infra|deploy|k8s)\b/i.test(raw)) type = 'INFRA';
    else if (/\b(add|create|implement|build|introduce|new)\b/i.test(raw)) type = 'FEATURE';

    const affectedAreas: string[] = [];
    for (const entry of AREA_LEXICON) {
      if (entry.patterns.some((p) => p.test(raw))) affectedAreas.push(entry.area);
    }

    // Heuristic extras for trading/marketplace style features
    if (/trad|market|marketplace/i.test(raw)) {
      for (const area of ['economy', 'database', 'permissions']) {
        if (!affectedAreas.includes(area)) affectedAreas.push(area);
      }
    }
    if (/payment/i.test(raw) && !affectedAreas.includes('economy')) {
      affectedAreas.push('economy', 'database');
    }

    const keywords = tokenize(raw).filter((t) => t.length > 2);
    const intents: string[] = [];
    if (/do not|don't|avoid|never/i.test(raw)) intents.push('constraint');
    if (/replace|migrate from/i.test(raw)) intents.push('replacement');
    if (type === 'FEATURE') intents.push('extend-system');

    void lower;
    return {
      raw,
      type,
      affectedAreas: affectedAreas.length ? affectedAreas : ['general'],
      keywords: [...new Set(keywords)].slice(0, 24),
      intents,
    };
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function createTaskAnalyzer(): TaskAnalyzer {
  return new TaskAnalyzer();
}

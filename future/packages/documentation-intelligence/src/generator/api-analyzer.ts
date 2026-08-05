import type { ApiRouteHint, DocumentationArtifact } from '../types.js';
import { newId, nowIso } from '../types.js';
import { apiOverviewTemplate } from '../templates/api.js';

/**
 * API overview with business context — does not replace OpenAPI.
 */
export class APIAnalyzer {
  detectRoutes(snippets: string[]): ApiRouteHint[] {
    const out: ApiRouteHint[] = [];
    const re = /\b(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    for (const s of snippets) {
      let m: RegExpExecArray | null;
      const local = s.slice(0, 12000);
      while ((m = re.exec(local))) {
        const method = m[1]!.toUpperCase();
        const path = m[2]!;
        const window = local.slice(Math.max(0, m.index - 80), m.index + 160);
        out.push({
          method,
          path,
          permissions: extractPermissions(window),
          schema: /zod|schema|dto/i.test(window) ? 'schema detected nearby' : undefined,
          businessContext: inferBusiness(path),
        });
        if (out.length >= 40) return out;
      }
    }
    return out;
  }

  generateOverview(routes: ApiRouteHint[]): DocumentationArtifact {
    return {
      id: newId('doc'),
      type: 'API_DOC',
      source: 'generated',
      path: '.neuron/docs/api-overview.md',
      title: 'API Overview',
      content: apiOverviewTemplate(routes),
      generatedFrom: ['routes', 'controllers', 'schemas', 'permissions'],
      lastUpdated: nowIso(),
      confidence: routes.length ? 0.72 : 0.4,
      status: 'CURRENT',
    };
  }
}

function extractPermissions(ctx: string): string[] {
  const perms: string[] = [];
  if (/admin|requireadmin/i.test(ctx)) perms.push('admin');
  if (/auth|jwt|requireuser/i.test(ctx)) perms.push('authenticated');
  if (/role|permission|authorize/i.test(ctx)) perms.push('authorized');
  return perms;
}

function inferBusiness(path: string): string {
  if (/payment|refund|billing/i.test(path)) return 'Payments / billing flow';
  if (/auth|login|session/i.test(path)) return 'Authentication';
  if (/user/i.test(path)) return 'User management';
  if (/admin/i.test(path)) return 'Administration';
  return 'Application API';
}

export function createAPIAnalyzer(): APIAnalyzer {
  return new APIAnalyzer();
}

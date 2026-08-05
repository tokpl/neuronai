import type { ApiRouteHint } from '../types.js';

export function apiOverviewTemplate(routes: ApiRouteHint[]): string {
  return [
    '# API Overview',
    '',
    '_Business-context overview — not a replacement for OpenAPI._',
    '',
    ...(routes.length
      ? routes.map((r) => {
          const perms = r.permissions?.length ? ` · ${r.permissions.join(', ')}` : '';
          const biz = r.businessContext ? ` — ${r.businessContext}` : '';
          const schema = r.schema ? ` (${r.schema})` : '';
          return `- **${r.method} ${r.path}**${perms}${biz}${schema}`;
        })
      : ['- No routes detected in provided snippets.']),
    '',
  ].join('\n');
}

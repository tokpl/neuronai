import type { PerformanceFinding } from '../types.js';
import { newId } from '../types.js';

export interface ApiEndpointHint {
  method: string;
  path: string;
  context?: string;
}

/**
 * API performance analyzer — payload/pagination/middleware heuristics.
 */
export class APIPerformanceAnalyzer {
  analyze(input: {
    endpoints?: ApiEndpointHint[];
    snippets?: string[];
  }): PerformanceFinding[] {
    const findings: PerformanceFinding[] = [];
    const endpoints =
      input.endpoints ?? detectEndpoints(input.snippets ?? []);

    for (const ep of endpoints) {
      const ctx = `${ep.method} ${ep.path}\n${ep.context ?? ''}`.toLowerCase();
      const isList = /list|search|find|index|\/users|\/products|\/orders/.test(ctx);

      if (isList && !/page|limit|cursor|offset|take\s*:|pagination/.test(ctx)) {
        findings.push({
          id: newId('pf'),
          type: 'API',
          title: `Missing pagination: ${ep.method} ${ep.path}`,
          detail: 'List-like endpoint without pagination signals.',
          severity: 'HIGH',
          confidence: 0.8,
          recommendation: 'Add limit/cursor pagination to bound response size.',
          evidence: ['list endpoint', 'no pagination keywords'],
        });
      }

      if (/include\s*:\s*true|populate\(|select\s+\*/i.test(ctx)) {
        findings.push({
          id: newId('pf'),
          type: 'API',
          title: `Heavy payload risk: ${ep.method} ${ep.path}`,
          detail: 'Endpoint may over-fetch nested data.',
          severity: 'MEDIUM',
          confidence: 0.65,
          recommendation: 'Return DTOs with only required fields.',
          evidence: ['wide populate/include'],
        });
      }

      if (/middleware[\s\S]{0,80}(auth|log|rate)[\s\S]{0,200}(auth|log|rate)[\s\S]{0,200}(auth|log|rate)/i.test(ctx)) {
        findings.push({
          id: newId('pf'),
          type: 'API',
          title: `Dense middleware chain: ${ep.path}`,
          detail: 'Many middleware layers can add latency on hot paths.',
          severity: 'LOW',
          confidence: 0.45,
          recommendation: 'Keep critical-path middleware lean.',
          evidence: ['repeated middleware signals'],
        });
      }
    }

    const blob = (input.snippets ?? []).join('\n').toLowerCase();
    if (/json\.stringify\([\s\S]{0,40}(rows|items|results)/i.test(blob)) {
      findings.push({
        id: newId('pf'),
        type: 'API',
        title: 'Large JSON serialization',
        detail: 'Serializing full result sets can dominate CPU/time.',
        severity: 'MEDIUM',
        confidence: 0.55,
        recommendation: 'Paginate and stream when possible.',
        evidence: ['stringify of collections'],
      });
    }

    return findings;
  }
}

function detectEndpoints(snippets: string[]): ApiEndpointHint[] {
  const out: ApiEndpointHint[] = [];
  const re = /\b(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  for (const s of snippets) {
    let m: RegExpExecArray | null;
    const local = s.slice(0, 10000);
    while ((m = re.exec(local))) {
      out.push({
        method: m[1]!.toUpperCase(),
        path: m[2]!,
        context: local.slice(Math.max(0, m.index - 100), m.index + 220),
      });
      if (out.length >= 30) return out;
    }
  }
  return out;
}

export function createAPIPerformanceAnalyzer(): APIPerformanceAnalyzer {
  return new APIPerformanceAnalyzer();
}

import type { PerformanceFinding } from '../types.js';
import { newId } from '../types.js';

export type FrontendStack = 'react' | 'nextjs' | 'vue' | 'angular' | 'unknown';

/**
 * Frontend performance heuristics for React / Next / Vue / Angular.
 */
export class FrontendPerformanceAnalyzer {
  detectStack(snippets: string[], filePaths: string[] = []): FrontendStack {
    const blob = [...snippets, ...filePaths].join('\n').toLowerCase();
    if (/next\/|from ['"]next\//.test(blob)) return 'nextjs';
    if (/from ['"]react['"]|usestate|useeffect/.test(blob)) return 'react';
    if (/from ['"]vue['"]|definecomponent|<script setup/.test(blob)) return 'vue';
    if (/@angular\/|@component\(/.test(blob)) return 'angular';
    return 'unknown';
  }

  analyze(input: { snippets?: string[]; filePaths?: string[] }): PerformanceFinding[] {
    const snippets = input.snippets ?? [];
    const paths = input.filePaths ?? [];
    const stack = this.detectStack(snippets, paths);
    const blob = [...snippets, ...paths].join('\n');
    const findings: PerformanceFinding[] = [];

    if (stack === 'react' || stack === 'nextjs') {
      if (/useeffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*setstate|set[A-Z]/i.test(blob) && !/\[.*\]/.test(blob)) {
        findings.push(f('Possible unstable effect deps', 'MEDIUM', 'Verify effect dependency arrays'));
      }
      if (/\.map\s*\(/.test(blob) && !/memo|usecallback|usememo|react\.memo/.test(blob.toLowerCase())) {
        findings.push(
          f('List render without memoization signals', 'MEDIUM', 'Memoize list items / callbacks'),
        );
      }
      if (stack === 'nextjs' && /getserversideprops|getstaticprops/i.test(blob) && /findmany|findall/i.test(blob)) {
        findings.push(
          f('Data-heavy Next.js data fetch', 'HIGH', 'Paginate SSR data; cache where safe'),
        );
      }
    }

    if (stack === 'vue') {
      if (/watch\s*\(/.test(blob) && /deep\s*:\s*true/.test(blob)) {
        findings.push(f('Deep Vue watchers', 'MEDIUM', 'Prefer computed / shallow watches'));
      }
      if (!/v-memo|computed\(/.test(blob) && /v-for/.test(blob)) {
        findings.push(f('v-for without memo/computed signals', 'LOW', 'Review list rendering cost'));
      }
    }

    if (stack === 'angular') {
      if (/changedetectionstrategy\.default/i.test(blob) || !/onpush/i.test(blob)) {
        findings.push(
          f('Angular change detection may be Default', 'MEDIUM', 'Prefer OnPush for large trees'),
        );
      }
      if (/\*ngfor/.test(blob.toLowerCase()) && !/trackby/i.test(blob)) {
        findings.push(f('ngFor without trackBy', 'MEDIUM', 'Add trackBy to reduce DOM churn'));
      }
    }

    if (paths.some((p) => /page\.tsx$|app\.tsx$|main\.vue$|app\.component\.ts$/i.test(p))) {
      const size = snippets.reduce((n, s) => n + s.length, 0);
      if (size > 8000) {
        findings.push(
          f('Huge root/page component', 'HIGH', 'Split routes/components; lazy-load heavy UI'),
        );
      }
    }

    if (/import\s+\*\s+as\s+|from ['"]lodash['"]|moment\b/.test(blob)) {
      findings.push(
        f('Possible bundle weight', 'MEDIUM', 'Prefer tree-shakeable imports / lighter libs'),
      );
    }

    return findings;
  }
}

function f(title: string, severity: PerformanceFinding['severity'], recommendation: string): PerformanceFinding {
  return {
    id: newId('pf'),
    type: 'FRONTEND',
    title,
    detail: title,
    severity,
    confidence: 0.6,
    recommendation,
    evidence: ['frontend heuristics'],
  };
}

export function createFrontendPerformanceAnalyzer(): FrontendPerformanceAnalyzer {
  return new FrontendPerformanceAnalyzer();
}

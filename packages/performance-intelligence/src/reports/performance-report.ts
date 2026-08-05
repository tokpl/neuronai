import type {
  OptimizationRecord,
  PerformanceFinding,
  PerformanceMemory,
  PerformanceReviewResult,
  ProjectScaleProfile,
  ScalabilityWarning,
} from '../types.js';

export class PerformanceReportGenerator {
  markdown(input: {
    overview?: string;
    criticalFlows?: string[];
    findings?: PerformanceFinding[];
    scalability?: ScalabilityWarning[];
    memories?: PerformanceMemory[];
    optimizations?: OptimizationRecord[];
    previousIncidents?: Array<{ id?: string; title: string }>;
    profile?: ProjectScaleProfile;
    review?: PerformanceReviewResult;
  }): string {
    const findings = input.findings ?? input.review?.findings ?? [];
    const scalability = input.scalability ?? input.review?.scalability ?? [];
    const incidents = input.previousIncidents ?? input.review?.relatedIncidents ?? [];
    const flows =
      input.criticalFlows ??
      input.profile?.criticalFlows ??
      input.review?.profile.criticalFlows ??
      [];

    return [
      '# Performance Report',
      '',
      '_Neuron Performance Intelligence — advisor only. Not an APM / production monitor._',
      '',
      '## Overview',
      '',
      input.overview ?? 'Local architectural performance review.',
      '',
      '## Critical paths',
      '',
      ...(flows.length ? flows.map((f) => `- ${f}`) : ['- (none configured)']),
      '',
      '## Issues',
      '',
      ...(findings.length
        ? findings.map((f) => `- **[${f.severity}] ${f.type}** — ${f.title}: ${f.detail}`)
        : ['- No issues in this pass.']),
      '',
      '## Risks',
      '',
      ...(scalability.length
        ? scalability.map((s) => `- **${s.severity}** — ${s.warning}`)
        : ['- No scalability warnings.']),
      '',
      '## Recommendations',
      '',
      ...[
        ...findings.map((f) => f.recommendation),
        ...scalability.map((s) => s.recommendation),
        ...(input.optimizations ?? []).map((o) => `Prior win: ${o.solution} → ${o.result}`),
        'Human review required — Neuron does not deploy optimizations.',
      ]
        .filter(Boolean)
        .slice(0, 25)
        .map((r) => `- ${r}`),
      '',
      '## Previous incidents',
      '',
      ...(incidents.length
        ? incidents.map((i) => `- ${i.id ? `${i.id}: ` : ''}${i.title}`)
        : ['- None linked.']),
      '',
    ].join('\n');
  }
}

export function createPerformanceReportGenerator(): PerformanceReportGenerator {
  return new PerformanceReportGenerator();
}

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  ArchitectureHealthScore,
  ArchitectureRisk,
  RefactoringPlan,
} from '../types.js';
import { nowIso } from '../types.js';

export interface ArchitectureHealthReportInput {
  overview: string;
  score: ArchitectureHealthScore;
  strengths: string[];
  problems: string[];
  risks: ArchitectureRisk[];
  recommendations: string[];
  plans?: RefactoringPlan[];
}

export function renderArchitectureHealthReport(
  input: ArchitectureHealthReportInput,
): string {
  const lines = [
    '# Architecture Health',
    '',
    `_Generated ${nowIso()}_`,
    '',
    `**Architecture Health: ${input.score.score}/100**`,
    '',
    input.score.breakdown.map((b) => `- ${b}`).join('\n'),
    '',
    '## Overview',
    '',
    input.overview,
    '',
    '## Strengths',
    '',
  ];
  if (!input.strengths.length) lines.push('_None recorded._');
  else for (const s of input.strengths) lines.push(`- ${s}`);

  lines.push('', '## Problems', '');
  if (!input.problems.length) lines.push('_No major problems detected._');
  else for (const p of input.problems) lines.push(`- ${p}`);

  lines.push('', '## Risks', '');
  if (!input.risks.length) lines.push('_No elevated risks._');
  else {
    for (const r of input.risks) {
      lines.push(`- **[${r.severity}]** ${r.title} — ${r.detail}`);
    }
  }

  lines.push('', '## Recommendations', '');
  if (!input.recommendations.length) lines.push('_Keep monitoring with neuron_architecture_scan._');
  else for (const r of input.recommendations) lines.push(`- ${r}`);

  if (input.plans?.length) {
    lines.push('', '## Suggested refactor plans (manual)', '');
    for (const p of input.plans.slice(0, 8)) {
      lines.push(
        `### ${p.problem}`,
        '',
        `- Impact: ${p.impact}`,
        `- Effort: ${p.estimatedEffort}`,
        `- Risk: ${p.risk}`,
        '- Steps:',
        ...p.suggestedSteps.map((s) => `  1. ${s}`),
        '',
      );
    }
  }

  lines.push(
    '',
    '---',
    '',
    '_Neuron analyzes and proposes. It does not auto-rewrite the codebase._',
    '',
  );
  return lines.join('\n');
}

export async function writeArchitectureHealthReport(
  neuronDir: string,
  input: ArchitectureHealthReportInput,
  filename = 'architecture-health.md',
): Promise<string> {
  await mkdir(neuronDir, { recursive: true });
  const path = join(neuronDir, filename);
  await writeFile(path, renderArchitectureHealthReport(input), 'utf8');
  return path;
}

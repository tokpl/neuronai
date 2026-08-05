import type { ArchitectReport } from '../types.js';

/**
 * Standard Architecture Proposal markdown.
 */
export function renderArchitectReport(report: ArchitectReport): string {
  const { requirement, proposal, plan, risk, impact, adr, review, score } = report;
  return [
    '# Architecture Proposal',
    '',
    `_Mode: ${report.mode} · Generated: ${report.generatedAt}_`,
    '',
    '## Understanding',
    '',
    proposal.understanding,
    '',
    `- Feature: **${requirement.feature}**`,
    `- Affected: ${requirement.affected.join(', ')}`,
    `- Complexity: **${requirement.complexity}**`,
    `- Risk: **${requirement.risk}**`,
    '',
    '## Existing System',
    '',
    ...proposal.existingSystem.map((l) => `- ${l}`),
    '',
    '## Proposed Solution',
    '',
    proposal.recommendation,
    '',
    '## Alternatives',
    '',
    ...proposal.options.map(
      (o) =>
        `### Option ${o.id}: ${o.title}\n\n${o.summary}\n\nPros:\n${o.pros.map((p) => `- ${p}`).join('\n')}\n\nCons:\n${o.cons.map((c) => `- ${c}`).join('\n')}\n`,
    ),
    `**Recommendation:** Option ${proposal.recommendedOptionId}`,
    '',
    '## Risks',
    '',
    `Risk: **${risk.level}**`,
    '',
    ...risk.reasons.map((r) => `- ${r}`),
    '',
    '### Dependency impact',
    '',
    `- Root: ${impact.root}`,
    `- Affects: ${impact.affected.join(', ')}`,
    '',
    '## Implementation Plan',
    '',
    ...plan.steps.map((s) => `${s.order}. **${s.title}** — ${s.detail}`),
    '',
    '## Decisions',
    '',
    `- ${adr.title}`,
    `- Decision: ${adr.decision}`,
    `- Reason: ${adr.reason}`,
    `- Status: **${adr.status}**`,
    '',
    '## Questions',
    '',
    ...requirement.questions.map((q) => `- ${q}`),
    '',
    ...(review
      ? [
          '## Implementation Review',
          '',
          review.summary,
          ...review.issues.map((i) => `- Issue: ${i}`),
          ...review.brokenPatterns.map((b) => `- Pattern: ${b}`),
          '',
        ]
      : []),
    ...(score
      ? [
          '## Architecture Score',
          '',
          `- Before: **${score.before}**`,
          `- After: **${score.after}** (${score.delta >= 0 ? '+' : ''}${score.delta})`,
          `- Reason: ${score.reason}`,
          '',
        ]
      : []),
    '_Neuron proposes. Humans approve decisions. No autonomous coding._',
  ].join('\n');
}

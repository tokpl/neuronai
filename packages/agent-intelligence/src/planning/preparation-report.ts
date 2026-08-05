import type { AgentContext } from '../context/context-engine.js';
import type { ImplementationPlan } from './implementation-planner.js';

export interface PreparationReport {
  markdown: string;
  context: AgentContext;
  plan?: ImplementationPlan;
}

export function buildPreparationReport(
  context: AgentContext,
  plan?: ImplementationPlan,
): PreparationReport {
  const lines = [
    `# Preparation: ${context.task.raw}`,
    '',
    `Mode: **${context.mode}** · Type: **${context.task.type}**`,
    '',
    '## Relevant Architecture',
    ...context.architectureNotes.map((n) => `- ${n}`),
    '',
    '## Existing Decisions',
    ...(context.decisions.length
      ? context.decisions.map((d) => `- **${d.title}** — ${clip(d.content, 160)}`)
      : ['- No strong matching decisions yet']),
    '',
    '## Warnings',
    ...(context.warnings.length ? context.warnings.map((w) => `- ⚠ ${w}`) : ['- None']),
    '',
    '## Suggested Approach',
    ...(plan
      ? plan.steps.map((s) => `${s.order}. ${s.title} — ${s.detail}`)
      : ['- Gather more project memories, then draft a module plan']),
    '',
    '## Compact briefing',
    '```',
    context.briefing,
    '```',
  ];

  return { markdown: lines.join('\n'), context, plan };
}

function clip(text: string, n: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

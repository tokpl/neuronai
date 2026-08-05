import type { ModuleDocInput } from '../types.js';

export function moduleTemplate(input: ModuleDocInput): string {
  return [
    `# ${input.name} Module`,
    '',
    '## Purpose',
    '',
    input.purpose ?? `${input.name} module responsibilities within the system.`,
    '',
    '## Responsibilities',
    '',
    ...(input.responsibilities?.length
      ? input.responsibilities.map((r) => `- ${r}`)
      : ['- (define responsibilities)']),
    '',
    '## Dependencies',
    '',
    ...(input.dependencies?.length
      ? input.dependencies.map((d) => `- ${d}`)
      : ['- (none listed)']),
    '',
    '## API',
    '',
    ...(input.api?.length ? input.api.map((a) => `- ${a}`) : ['- (no API surface documented)']),
    '',
    '## Security notes',
    '',
    ...(input.securityNotes?.length
      ? input.securityNotes.map((s) => `- ${s}`)
      : ['- Follow project SECURITY constitution rules']),
    '',
    '## Known issues',
    '',
    ...(input.knownIssues?.length
      ? input.knownIssues.map((i) => `- ${i}`)
      : ['- None recorded']),
    '',
    '## Related decisions',
    '',
    ...(input.relatedDecisions?.length
      ? input.relatedDecisions.map((d) => `- ${d}`)
      : ['- None linked']),
    '',
  ].join('\n');
}

import type { ProjectBrainSnapshot } from '../types.js';

export function onboardingTemplate(brain: ProjectBrainSnapshot): string {
  const name = brain.projectName ?? 'the project';
  return [
    '# New Developer Guide',
    '',
    '## Project overview',
    '',
    `Welcome to **${name}**.`,
    '',
    brain.architectureNotes?.[0] ??
      `Key modules: ${(brain.modules ?? ['Core']).join(', ')}.`,
    '',
    '## How the system works',
    '',
    ...(brain.dataFlows?.length
      ? brain.dataFlows.map((f) => `- ${f}`)
      : ['- Client calls API', '- Services enforce business rules', '- Database persists state']),
    '',
    '## Important rules',
    '',
    ...(brain.rules?.length
      ? brain.rules.map((r) => `- ${r}`)
      : ['- Follow Project Constitution', '- Prefer existing architecture decisions']),
    '',
    '## Common mistakes',
    '',
    ...(brain.mistakes?.length
      ? brain.mistakes.map((m) => `- ${m}`)
      : ['- Ignoring prior ADRs', '- Duplicating auth configuration']),
    '',
    '## Development workflow',
    '',
    '1. Read architecture + constitution',
    '2. Call Neuron context / architect tools for larger features',
    '3. Implement with tests',
    '4. Update or regenerate living docs under `.neuron/docs/`',
    '',
  ].join('\n');
}

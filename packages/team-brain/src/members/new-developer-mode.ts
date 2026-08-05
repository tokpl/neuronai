import type { TeamDocument } from '@neuron-ai-memory/team-memory';
import { createOnboardingEngine } from '@neuron-ai-memory/team-memory';

import type { OnboardingBundle } from '../types.js';

/**
 * NewDeveloperMode — generate project introduction for a new teammate.
 * Technical knowledge only (no user profiles / social).
 */
export class NewDeveloperMode {
  private readonly onboarding = createOnboardingEngine();

  generate(doc: TeamDocument, actorId?: string): { bundle: OnboardingBundle; doc: TeamDocument } {
    const actor =
      doc.actors.find((a) => a.id === actorId) ??
      doc.actors.find((a) => a.role === 'viewer') ??
      doc.actors[0];

    if (!actor) {
      const empty: OnboardingBundle = {
        projectIntroduction: `Welcome to ${doc.teamName}. No shared knowledge yet — ask a teammate to approve architecture decisions.`,
        architectureOverview: [],
        importantDecisions: [],
        commonMistakes: [],
        securityRules: [],
        markdown: `# Onboarding — ${doc.teamName}\n\nNo shared memories yet.`,
      };
      return { bundle: empty, doc };
    }

    const { pack, doc: next } = this.onboarding.generate(doc, actor);
    const securityRules = pack.codingRules.filter((r) =>
      /security|auth|secret|permission|threat/i.test(r),
    );
    const bundle: OnboardingBundle = {
      projectIntroduction: [
        `Welcome to **${doc.teamName}** (project ${doc.projectId}).`,
        'Neuron will walk you through architecture, decisions, mistakes, and security rules — local team brain only.',
      ].join(' '),
      architectureOverview: pack.architectureOverview,
      importantDecisions: pack.importantDecisions,
      commonMistakes: pack.commonMistakes,
      securityRules: securityRules.length ? securityRules : pack.codingRules.slice(0, 5),
      markdown: [
        `# New developer mode — ${doc.teamName}`,
        '',
        pack.markdown,
        '',
        '## Security rules',
        ...(securityRules.length ? securityRules.map((s) => `- ${s}`) : ['- (none tagged yet)']),
      ].join('\n'),
    };
    return { bundle, doc: next };
  }
}

export function createNewDeveloperMode(): NewDeveloperMode {
  return new NewDeveloperMode();
}

import type { DocumentationArtifact, ProjectBrainSnapshot } from '../types.js';
import { newId, nowIso } from '../types.js';
import { onboardingTemplate } from '../templates/onboarding.js';

export class OnboardingGenerator {
  generate(brain: ProjectBrainSnapshot): DocumentationArtifact {
    return {
      id: newId('doc'),
      type: 'ONBOARDING_DOC',
      source: 'generated',
      path: '.neuron/docs/onboarding.md',
      title: 'New Developer Guide',
      content: onboardingTemplate(brain),
      generatedFrom: ['overview', 'rules', 'mistakes', 'workflow'],
      lastUpdated: nowIso(),
      confidence: 0.78,
      status: 'CURRENT',
    };
  }
}

export function createOnboardingGenerator(): OnboardingGenerator {
  return new OnboardingGenerator();
}

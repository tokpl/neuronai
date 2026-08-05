import type { DocumentationArtifact, ProjectBrainSnapshot } from '../types.js';
import { newId, nowIso } from '../types.js';
import { architectureTemplate } from '../templates/architecture.js';

export class ArchitectureDocGenerator {
  generate(brain: ProjectBrainSnapshot): DocumentationArtifact {
    const content = architectureTemplate(brain);
    return {
      id: newId('doc'),
      type: 'ARCHITECTURE_DOC',
      source: 'generated',
      path: '.neuron/docs/architecture.md',
      title: 'Architecture',
      content,
      generatedFrom: [
        'modules',
        'dependencies',
        'decisions',
        ...(brain.architectureNotes?.length ? ['architectureNotes'] : []),
      ],
      lastUpdated: nowIso(),
      confidence: brain.modules?.length || brain.decisions?.length ? 0.8 : 0.55,
      status: 'CURRENT',
    };
  }
}

export function createArchitectureDocGenerator(): ArchitectureDocGenerator {
  return new ArchitectureDocGenerator();
}

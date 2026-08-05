import type { DocumentationArtifact, ModuleDocInput } from '../types.js';
import { newId, nowIso } from '../types.js';
import { moduleTemplate } from '../templates/module.js';

export class ModuleDocGenerator {
  generate(input: ModuleDocInput): DocumentationArtifact {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      id: newId('doc'),
      type: 'MODULE_DOC',
      source: 'generated',
      path: `.neuron/docs/modules/${slug}.md`,
      title: `${input.name} Module`,
      content: moduleTemplate(input),
      generatedFrom: ['module', 'dependencies', 'decisions', 'incidents'],
      lastUpdated: nowIso(),
      confidence: 0.75,
      status: 'CURRENT',
    };
  }

  generateMany(modules: ModuleDocInput[]): DocumentationArtifact[] {
    return modules.map((m) => this.generate(m));
  }
}

export function createModuleDocGenerator(): ModuleDocGenerator {
  return new ModuleDocGenerator();
}

import type { DocFact, ProjectBrainSnapshot } from '../types.js';

/**
 * Analyze existing docs vs project brain signals.
 */
export class DocumentationAnalyzer {
  extractFactsFromMarkdown(markdown: string, location = 'docs'): DocFact[] {
    const facts: DocFact[] = [];
    const lines = markdown.split(/\r?\n/);
    for (const line of lines) {
      const db = line.match(/\b(?:database|db|datastore)\s*[:=]\s*([A-Za-z0-9+._-]+)/i);
      if (db) {
        facts.push({
          key: 'database',
          value: db[1]!,
          source: 'docs',
          location,
        });
      }
      const fw = line.match(/\b(?:framework|stack)\s*[:=]\s*([A-Za-z0-9+._-]+)/i);
      if (fw) {
        facts.push({ key: 'framework', value: fw[1]!, source: 'docs', location });
      }
      const lang = line.match(/\b(?:language|runtime)\s*[:=]\s*([A-Za-z0-9+._-]+)/i);
      if (lang) {
        facts.push({ key: 'language', value: lang[1]!, source: 'docs', location });
      }
      const mod = line.match(/^\s*[-*]\s*(?:module|service)\s*[:=]?\s*(.+)$/i);
      if (mod) {
        facts.push({ key: 'module', value: mod[1]!.trim(), source: 'docs', location });
      }
    }

    // Heading-based module mentions
    for (const m of markdown.matchAll(/^#+\s+([A-Za-z][\w\s/-]{1,40})\s*$/gm)) {
      const title = m[1]!.trim();
      if (/module|service|api|auth|payment/i.test(title)) {
        facts.push({ key: 'module', value: title, source: 'docs', location });
      }
    }

    return facts;
  }

  brainFacts(brain: ProjectBrainSnapshot): DocFact[] {
    const facts: DocFact[] = [];
    for (const db of brain.databases ?? []) {
      facts.push({ key: 'database', value: db, source: 'brain' });
    }
    for (const fw of brain.frameworks ?? []) {
      facts.push({ key: 'framework', value: fw, source: 'brain' });
    }
    for (const mod of brain.modules ?? []) {
      facts.push({ key: 'module', value: mod, source: 'brain' });
    }
    for (const d of brain.dependencies ?? []) {
      facts.push({ key: 'dependency', value: d, source: 'brain' });
    }
    return facts;
  }

  summarizeCoverage(input: {
    hasReadme: boolean;
    hasArchitecture: boolean;
    hasOnboarding: boolean;
    hasApi: boolean;
    moduleCount: number;
    documentedModules: number;
  }): string[] {
    const notes: string[] = [];
    if (!input.hasReadme) notes.push('Missing README');
    if (!input.hasArchitecture) notes.push('Missing architecture doc');
    if (!input.hasOnboarding) notes.push('Missing onboarding guide');
    if (!input.hasApi) notes.push('Missing API overview');
    if (input.moduleCount > 0 && input.documentedModules / input.moduleCount < 0.5) {
      notes.push('Module documentation coverage below 50%');
    }
    return notes;
  }
}

export function createDocumentationAnalyzer(): DocumentationAnalyzer {
  return new DocumentationAnalyzer();
}

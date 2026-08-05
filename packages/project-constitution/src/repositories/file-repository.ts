import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  createEmptyConstitution,
  type ProjectConstitutionDocument,
} from '../rules/types.js';

export class ConstitutionFileRepository {
  constructor(private readonly neuronDir: string) {}

  path(): string {
    return join(this.neuronDir, 'constitution.json');
  }

  markdownPath(): string {
    return join(this.neuronDir, 'constitution.md');
  }

  async load(projectId: string, projectName: string): Promise<ProjectConstitutionDocument> {
    try {
      const raw = JSON.parse(await readFile(this.path(), 'utf8')) as ProjectConstitutionDocument;
      if (raw.version !== 1) return createEmptyConstitution(projectId, projectName);
      return raw;
    } catch {
      return createEmptyConstitution(projectId, projectName);
    }
  }

  async save(doc: ProjectConstitutionDocument): Promise<void> {
    await mkdir(dirname(this.path()), { recursive: true });
    await writeFile(this.path(), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }

  async saveMarkdown(markdown: string): Promise<string> {
    await mkdir(dirname(this.markdownPath()), { recursive: true });
    await writeFile(this.markdownPath(), markdown, 'utf8');
    return this.markdownPath();
  }
}

export function createConstitutionRepository(neuronDir: string): ConstitutionFileRepository {
  return new ConstitutionFileRepository(neuronDir);
}

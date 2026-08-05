import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { DocumentationArtifact } from '../types.js';

/**
 * Persist generated docs under .neuron/docs/ — separate from manual docs/.
 */
export class DocumentationSync {
  docsRoot(neuronDir: string): string {
    return join(neuronDir, 'docs');
  }

  async writeArtifact(neuronDir: string, artifact: DocumentationArtifact): Promise<string> {
    const relative = artifact.path.replace(/^\.neuron\/docs\//, '').replace(/^\.neuron\\docs\\/, '');
    const abs = join(this.docsRoot(neuronDir), relative);
    await mkdir(dirname(abs), { recursive: true });
    const banner =
      artifact.source === 'generated'
        ? `<!-- neuron:generated type=${artifact.type} id=${artifact.id} -->\n\n`
        : '';
    await writeFile(abs, banner + artifact.content, 'utf8');
    return abs;
  }

  async writeAll(neuronDir: string, artifacts: DocumentationArtifact[]): Promise<string[]> {
    const paths: string[] = [];
    for (const a of artifacts) {
      paths.push(await this.writeArtifact(neuronDir, a));
    }
    // Index
    const index = [
      '# Neuron generated documentation',
      '',
      '_Generated docs live under `.neuron/docs/`. Manual docs stay in `docs/`._',
      '',
      ...artifacts.map((a) => `- [${a.title}](${a.path.replace(/^\.neuron\/docs\//, '')}) — ${a.type}`),
      '',
    ].join('\n');
    const indexPath = join(this.docsRoot(neuronDir), 'README.md');
    await mkdir(this.docsRoot(neuronDir), { recursive: true });
    await writeFile(indexPath, index, 'utf8');
    paths.push(indexPath);
    return paths;
  }
}

export function createDocumentationSync(): DocumentationSync {
  return new DocumentationSync();
}

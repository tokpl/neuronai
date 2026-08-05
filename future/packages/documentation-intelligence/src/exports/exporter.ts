import type { DocumentationArtifact, ExportFormat } from '../types.js';

export class DocumentationExporter {
  export(artifact: DocumentationArtifact, format: ExportFormat): string {
    if (format === 'markdown') return artifact.content;
    if (format === 'json') {
      return JSON.stringify(
        {
          id: artifact.id,
          type: artifact.type,
          source: artifact.source,
          path: artifact.path,
          title: artifact.title,
          content: artifact.content,
          generatedFrom: artifact.generatedFrom,
          lastUpdated: artifact.lastUpdated,
          confidence: artifact.confidence,
          status: artifact.status,
        },
        null,
        2,
      );
    }
    return toHtml(artifact);
  }

  exportMany(artifacts: DocumentationArtifact[], format: ExportFormat): string {
    if (format === 'json') {
      return JSON.stringify(
        artifacts.map((a) => JSON.parse(this.export(a, 'json'))),
        null,
        2,
      );
    }
    if (format === 'markdown') {
      return artifacts.map((a) => a.content).join('\n\n---\n\n');
    }
    return artifacts.map((a) => this.export(a, 'html')).join('\n<hr/>\n');
  }
}

function toHtml(artifact: DocumentationArtifact): string {
  const body = artifact.content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/```text\n([\s\S]*?)```/g, '<pre>$1</pre>')
    .replace(/\n\n/g, '<br/><br/>');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(artifact.title)}</title></head>
<body>
<p><em>Generated doc (${artifact.type}) — local only, not hosted.</em></p>
${body}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createDocumentationExporter(): DocumentationExporter {
  return new DocumentationExporter();
}

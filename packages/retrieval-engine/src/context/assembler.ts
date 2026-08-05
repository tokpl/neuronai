import type { AnalyzedQuery, AssembledContext, ContextConflict, RankedHit } from '../types.js';
import { estimateTokens } from '../types.js';
import type { MemoryCluster } from './clusterer.js';

export class ContextAssembler {
  assemble(input: {
    query: AnalyzedQuery;
    hits: RankedHit[];
    conflicts: ContextConflict[];
    clusters: MemoryCluster[];
    omitted: number;
    explanation: string[];
  }): AssembledContext {
    const { query, hits, conflicts, clusters, omitted, explanation } = input;

    const architecture = hits
      .filter((h) => h.source === 'knowledge_graph' || /architect|module|service/i.test(h.title))
      .slice(0, 8)
      .map((h) => `- ${h.title}: ${h.content}`);

    const importantDecisions = hits
      .filter((h) => h.source === 'decision' || h.type === 'architecture_decision')
      .slice(0, 8)
      .map((h) => `- ${h.title}: ${h.content}`);

    const relatedFiles = hits
      .filter((h) => h.source === 'code')
      .slice(0, 12)
      .map((h) => `- ${h.title}`);

    const warnings = [
      ...hits
        .filter((h) => /do not|never|warning|mistake|bypass/i.test(`${h.title} ${h.content}`))
        .slice(0, 8)
        .map((h) => `- ${h.title}: ${h.content}`),
      ...conflicts.map((c) => `- Conflict (${c.topic}): ${c.message}`),
    ];

    const existingPatterns = hits
      .filter((h) => h.source === 'style' || h.type === 'pattern' || h.source === 'constitution')
      .slice(0, 8)
      .map((h) => `- ${h.title}: ${h.content}`);

    const suggestedApproach = [
      `Intent: ${query.intent} · Risk: ${query.risk} · Domains: ${query.domains.join(', ')}`,
      query.related.length ? `Also consider: ${query.related.join(', ')}` : undefined,
      'Prefer existing patterns and active constitution rules before inventing new ones.',
      conflicts.length
        ? 'Resolve architecture conflicts using the newer decision only.'
        : undefined,
    ].filter(Boolean) as string[];

    const markdown = [
      '# Agent Context',
      '',
      '## Architecture',
      ...(architecture.length ? architecture : ['- (none ranked)']),
      '',
      '## Important Decisions',
      ...(importantDecisions.length ? importantDecisions : ['- (none ranked)']),
      '',
      '## Related Files',
      ...(relatedFiles.length ? relatedFiles : ['- (none ranked)']),
      '',
      '## Warnings',
      ...(warnings.length ? warnings : ['- (none)']),
      '',
      '## Existing Patterns',
      ...(existingPatterns.length ? existingPatterns : ['- (none ranked)']),
      '',
      '## Suggested Approach',
      ...suggestedApproach.map((l) => `- ${l}`),
      '',
      '## Knowledge Clusters',
      ...clusters.map((c) => `- ${c.name}: ${c.items.length} items`),
    ].join('\n');

    return {
      architecture,
      importantDecisions,
      relatedFiles,
      warnings,
      existingPatterns,
      suggestedApproach,
      conflicts,
      clusters: clusters.map((c) => ({
        name: c.name,
        items: c.items.map((i) => i.title),
      })),
      markdown,
      tokenEstimate: estimateTokens(markdown),
      selected: hits,
      omitted,
      explanation,
    };
  }
}

export function createContextAssembler(): ContextAssembler {
  return new ContextAssembler();
}

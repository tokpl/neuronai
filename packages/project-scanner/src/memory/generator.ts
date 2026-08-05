import type {
  ArchitectureMap,
  DependencyEdge,
  DocInsight,
  GeneratedMemory,
  GitInsight,
  ProjectStackProfile,
  SuggestedRule,
} from '../types.js';

/**
 * Generate initial project brain memories from scan signals.
 */
export class InitialMemoryGenerator {
  generate(input: {
    stack: ProjectStackProfile;
    architecture: ArchitectureMap;
    dependencyGraph: DependencyEdge[];
    git: GitInsight;
    docs: DocInsight;
  }): GeneratedMemory[] {
    const memories: GeneratedMemory[] = [];

    if (input.architecture.modules.length >= 2) {
      memories.push({
        title: 'Project uses modular architecture',
        content: `Detected modules: ${input.architecture.modules.slice(0, 12).join(', ')}. Prefer keeping boundaries between modules.`,
        type: 'architecture_decision',
        confidence: 0.95,
        source: 'Code analysis',
        tags: ['architecture', 'modules'],
      });
    }

    if (input.stack.frontend.length || input.stack.backend.length) {
      memories.push({
        title: `Stack: ${[...input.stack.frontend, ...input.stack.backend].slice(0, 4).join(' / ')}`,
        content: [
          input.stack.frontend.length ? `Frontend: ${input.stack.frontend.join(', ')}` : null,
          input.stack.backend.length ? `Backend: ${input.stack.backend.join(', ')}` : null,
          input.stack.database.length ? `Database: ${input.stack.database.join(', ')}` : null,
          input.stack.tools.length ? `Tools: ${input.stack.tools.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('. '),
        type: 'dependency',
        confidence: 0.93,
        source: 'Stack detection',
        tags: ['stack'],
      });
    }

    if (input.stack.database.length) {
      memories.push({
        title: `Database is ${input.stack.database[0]}`,
        content: `Project appears to use ${input.stack.database.join(', ')} as data store.`,
        type: 'knowledge',
        confidence: 0.9,
        source: 'Manifest / config detection',
        tags: ['database'],
      });
    }

    if (input.architecture.services.length >= 3) {
      memories.push({
        title: 'Service-oriented code layout',
        content: `Detected ${input.architecture.services.length} *Service modules. Prefer putting business logic in services.`,
        type: 'pattern',
        confidence: 0.88,
        source: 'Code pattern detection',
        tags: ['services', 'pattern'],
      });
    }

    const authish = [...input.architecture.modules, ...input.architecture.services].some((x) =>
      /auth|jwt|session/i.test(x),
    );
    if (authish) {
      memories.push({
        title: 'Authentication is handled by JWT / auth modules',
        content:
          'Auth-related modules/services detected. Prefer existing auth middleware over ad-hoc checks.',
        type: 'pattern',
        confidence: 0.91,
        source: 'Code pattern detection',
        tags: ['auth'],
      });
    }

    for (const edge of input.dependencyGraph.filter((e) => e.relation === 'USES').slice(0, 8)) {
      memories.push({
        title: `${edge.from} uses ${edge.to}`,
        content: `Dependency graph: ${edge.from} → ${edge.to}.`,
        type: 'dependency',
        confidence: 0.86,
        source: 'Dependency graph',
        tags: ['dependencies'],
      });
    }

    for (const d of input.git.potentialDecisions.slice(0, 5)) {
      memories.push({
        title: `Potential decision: ${d.message}`,
        content: `${d.reason}. Commit: "${d.message}". Review before treating as official PROJECT truth.`,
        type: 'architecture_decision',
        confidence: d.confidence,
        source: 'Git history analysis',
        tags: ['git', 'decision'],
      });
    }

    if (input.docs.readmeSummary) {
      memories.push({
        title: 'README project summary',
        content: input.docs.readmeSummary,
        type: 'knowledge',
        confidence: 0.8,
        source: 'Documentation ingestion',
        tags: ['docs'],
      });
    }

    for (const bullet of input.docs.knowledgeBullets.slice(0, 6)) {
      memories.push({
        title: bullet.slice(0, 80),
        content: bullet,
        type: 'knowledge',
        confidence: 0.75,
        source: 'Documentation ingestion',
        tags: ['docs'],
      });
    }

    return dedupeMemories(memories).slice(0, 80);
  }

  suggestRules(input: {
    architecture: ArchitectureMap;
    stack: ProjectStackProfile;
  }): SuggestedRule[] {
    const rules: SuggestedRule[] = [];
    if (input.architecture.services.length >= 3) {
      rules.push({
        rule: 'Use dependency injection / service modules for business logic',
        reason: 'Detected multiple *Service files - consistent DI/service pattern.',
        confidence: 0.84,
      });
    }
    if (input.architecture.controllers.length && input.architecture.repositories.length) {
      rules.push({
        rule: 'Controllers must not access the database directly - use repositories/services',
        reason: 'Both controllers and repositories detected.',
        confidence: 0.87,
      });
    }
    if (input.stack.frontend.includes('React') || input.stack.frontend.includes('Next.js')) {
      rules.push({
        rule: 'Keep UI in frontend modules; call backend via documented APIs only',
        reason: 'React/Next frontend detected.',
        confidence: 0.82,
      });
    }
    if (input.stack.database.some((d) => /postgres/i.test(d))) {
      rules.push({
        rule: 'PostgreSQL is the system of record - avoid dual-writes to other stores',
        reason: 'PostgreSQL detected in stack.',
        confidence: 0.9,
      });
    }
    return rules;
  }
}

function dedupeMemories(memories: GeneratedMemory[]): GeneratedMemory[] {
  const seen = new Set<string>();
  const out: GeneratedMemory[] = [];
  for (const m of memories) {
    const k = m.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

export function createInitialMemoryGenerator(): InitialMemoryGenerator {
  return new InitialMemoryGenerator();
}

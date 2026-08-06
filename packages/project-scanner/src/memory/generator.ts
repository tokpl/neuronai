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
        paths: moduleEvidencePaths(input.architecture.modules, input.architecture),
      });
    }

    for (const name of input.architecture.modules.slice(0, 16)) {
      const related = relatedPathsForModule(name, input.architecture);
      const hint = moduleLocationHint(name, related);
      memories.push({
        title: `${name} module`,
        content: `${hint} Module purpose inferred from path and naming.`,
        type: 'knowledge',
        confidence: 0.88,
        source: 'Code analysis',
        tags: ['structure', 'module', name.toLowerCase()],
        paths: related.length ? related.slice(0, 12) : [`src/${name}/`],
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
        paths: input.stack.manifests.slice(0, 8),
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
        paths: [
          ...input.stack.manifests.slice(0, 4),
          ...input.architecture.databaseLayers.slice(0, 8),
        ],
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
        paths: input.architecture.services.slice(0, 12),
      });
    }

    for (const layer of [
      { key: 'routes', label: 'API routes and endpoints', files: input.architecture.routes },
      {
        key: 'repositories',
        label: 'Repositories / data access',
        files: input.architecture.repositories,
      },
      { key: 'controllers', label: 'Controllers', files: input.architecture.controllers },
      {
        key: 'databaseLayers',
        label: 'Database schema and migrations',
        files: input.architecture.databaseLayers,
      },
    ] as const) {
      if (layer.files.length === 0) continue;
      memories.push({
        title: `${layer.label} live in: ${layer.files.slice(0, 3).join(', ')}`,
        content: `${layer.label} detected in ${layer.files.length} file(s): ${layer.files.slice(0, 12).join(', ')}.`,
        type: 'knowledge',
        confidence: 0.85,
        source: 'Code analysis',
        tags: ['structure', layer.key],
        paths: layer.files.slice(0, 20),
      });
    }

    const authish = [...input.architecture.modules, ...input.architecture.services].some((x) =>
      /auth|jwt|session/i.test(x),
    );
    if (authish) {
      const authPaths = [
        ...relatedPathsForModule('auth', input.architecture),
        ...input.architecture.middleware.filter((p) => /auth|jwt|session/i.test(p)),
      ];
      memories.push({
        title: 'Authentication is handled by JWT / auth modules',
        content:
          'Auth-related modules/services detected. Prefer existing auth middleware over ad-hoc checks.',
        type: 'pattern',
        confidence: 0.91,
        source: 'Code pattern detection',
        tags: ['auth'],
        paths: unique(authPaths).slice(0, 12),
      });
    }

    if ((input.architecture.middleware?.length ?? 0) > 0) {
      memories.push({
        title: 'Cross-cutting concerns use middleware',
        content: `Middleware detected in: ${(input.architecture.middleware ?? [])
          .slice(0, 8)
          .join(', ')}. Prefer middleware for auth, rate limiting and other cross-cutting concerns.`,
        type: 'pattern',
        confidence: 0.86,
        source: 'Code pattern detection',
        tags: ['middleware', 'api', 'pattern'],
        paths: (input.architecture.middleware ?? []).slice(0, 12),
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
        paths: [edge.from, edge.to].filter((p) => /[\\/]/.test(p)),
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
        paths: input.docs.docFiles.filter((f) => /readme/i.test(f)).slice(0, 4),
      });
    }

    for (const bullet of input.docs.knowledgeBullets.slice(0, 6)) {
      if (memories.some((m) => overlaps(bullet, `${m.title} ${m.content}`))) continue;
      memories.push({
        title: titleFrom(bullet),
        content: bullet,
        type: 'knowledge',
        confidence: 0.75,
        source: 'Documentation ingestion',
        tags: ['docs'],
        paths: extractPathMentions(bullet).slice(0, 8),
      });
    }

    return dedupeMemories(memories).slice(0, 80);
  }

  suggestRules(input: {
    architecture: ArchitectureMap;
    stack: ProjectStackProfile;
  }): SuggestedRule[] {
    const rules: SuggestedRule[] = [];
    if ((input.architecture.middleware?.length ?? 0) > 0) {
      rules.push({
        rule: 'Cross-cutting concerns belong in middleware, not route handlers',
        reason: 'Middleware files detected in the codebase.',
        confidence: 0.86,
      });
    }

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

function relatedPathsForModule(name: string, architecture: ArchitectureMap): string[] {
  const needle = name.toLowerCase();
  return unique(
    [
      ...architecture.services,
      ...architecture.routes,
      ...architecture.controllers,
      ...architecture.repositories,
      ...architecture.middleware,
      ...architecture.databaseLayers,
      ...architecture.entrypoints,
    ].filter(
      (p) =>
        p.toLowerCase().includes(`/${needle}/`) ||
        p.toLowerCase().includes(`/${needle}.`) ||
        p.toLowerCase().startsWith(`${needle}/`),
    ),
  );
}

function moduleEvidencePaths(modules: string[], architecture: ArchitectureMap): string[] {
  return unique(modules.flatMap((name) => relatedPathsForModule(name, architecture))).slice(0, 24);
}

function moduleLocationHint(name: string, related: string[]): string {
  if (related.length) {
    return `The ${name} module lives under paths such as ${related.slice(0, 4).join(', ')}.`;
  }
  return `The ${name} module is at src/${name}/ (or packages/${name}/ in a monorepo).`;
}

function extractPathMentions(text: string): string[] {
  const matches = text.match(
    /(?:^|[\s("`'])((?:src|apps|packages|lib|tests?|docs)\/[A-Za-z0-9_./-]+)/g,
  );
  if (!matches) return [];
  return unique(
    matches.map((m) => m.replace(/^[\s("`']+/, '').replace(/\\/g, '/')),
  );
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

function overlaps(candidate: string, existing: string): boolean {
  const a = words(candidate);
  const b = words(existing);
  if (a.size === 0) return true;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / a.size >= 0.7;
}

function titleFrom(bullet: string): string {
  const clean = bullet.replace(/\s+/g, ' ').trim();
  const clause = clean.split(/[.:;—-]\s/)[0] ?? clean;
  return (clause.length > 70 ? `${clause.slice(0, 69)}…` : clause) || clean.slice(0, 70);
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

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const p = raw.replace(/\\/g, '/');
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function createInitialMemoryGenerator(): InitialMemoryGenerator {
  return new InitialMemoryGenerator();
}

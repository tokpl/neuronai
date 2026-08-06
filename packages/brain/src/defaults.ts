import type {
  ActiveContext,
  Facet,
  FacetSource,
  KnowledgePlane,
  ProjectDna,
  ProjectGoals,
  ProjectHealth,
  Provenance,
} from './models.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function facet<T>(
  value: T,
  options: {
    confidence?: number;
    evidence?: Provenance[];
    source?: FacetSource;
  } = {},
): Facet<T> {
  return {
    value,
    confidence: options.confidence ?? 0.5,
    evidence: options.evidence ?? [],
    updatedAt: nowIso(),
    source: options.source ?? 'detect',
  };
}

export function emptyDna(partial?: {
  projectId?: string;
  name?: string;
  stack?: string[];
  summary?: string;
}): ProjectDna {
  const ts = nowIso();
  const dna: ProjectDna = {
    version: 1,
    identity: {},
    stack: {},
    structure: {},
    platforms: {},
    conventions: {},
    risk: {},
    meta: {
      generatedAt: ts,
      overallConfidence: 0,
      summary: partial?.summary,
    },
  };

  if (partial?.projectId) {
    dna.identity.projectId = facet(partial.projectId, {
      confidence: 1,
      source: 'user',
      evidence: [{ kind: 'user', note: 'project id' }],
    });
  }
  if (partial?.name) {
    dna.identity.name = facet(partial.name, {
      confidence: 1,
      source: 'user',
      evidence: [{ kind: 'user', note: 'project name' }],
    });
  }
  if (partial?.stack?.length) {
    dna.stack.tags = facet(partial.stack, {
      confidence: 0.8,
      source: 'detect',
      evidence: [{ kind: 'manifest', note: 'init stack' }],
    });
    dna.meta.overallConfidence = 0.8;
  }

  return dna;
}

export function emptyKnowledge(): KnowledgePlane {
  return {
    version: 1,
    updatedAt: nowIso(),
    memory: [],
    decisions: [],
    rules: [],
    graph: { nodes: [], edges: [] },
    insights: [],
    context: [],
  };
}

export function emptyHealth(): ProjectHealth {
  return {
    version: 1,
    updatedAt: nowIso(),
    score: 0,
    dnaFresh: false,
    knowledgeFresh: false,
    architectureHealthy: true,
    notes: ['Brain not yet scored'],
  };
}

export function emptyGoals(): ProjectGoals {
  return {
    version: 1,
    updatedAt: nowIso(),
    currentId: null,
    goals: [],
  };
}

export function emptyActive(): ActiveContext {
  return {
    version: 1,
    updatedAt: nowIso(),
    focus: null,
  };
}

export function computeHealth(
  dna: ProjectDna,
  knowledge: KnowledgePlane,
): ProjectHealth {
  const hasDna =
    Boolean(dna.identity.name ?? dna.identity.projectId ?? dna.stack.tags) ||
    dna.meta.overallConfidence > 0;
  const memoryCount =
    knowledge.memory.length + knowledge.decisions.length + knowledge.rules.length;
  const knowledgeFresh = memoryCount > 0;
  const dnaFresh = hasDna;
  const confidence = dna.meta.overallConfidence;
  let score = 0;
  if (dnaFresh) score += 35;
  if (knowledgeFresh) score += 40;
  score += Math.round(confidence * 25);
  score = Math.min(100, Math.max(0, score));

  return {
    version: 1,
    updatedAt: nowIso(),
    score,
    dnaFresh,
    knowledgeFresh,
    architectureHealthy: true,
    notes: [
      dnaFresh ? 'DNA present' : 'DNA empty — run neuron scan',
      knowledgeFresh ? `Knowledge entries: ${memoryCount}` : 'Knowledge empty',
    ],
  };
}

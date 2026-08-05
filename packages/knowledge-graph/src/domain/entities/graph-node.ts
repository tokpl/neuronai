/**
 * Project knowledge graph node types (Graph 2.0).
 * Grouped conceptually as Code / Architecture / Knowledge / Security / Performance / Workflow.
 */
export type GraphNodeType =
  | 'PROJECT'
  | 'MODULE'
  | 'FILE'
  | 'FUNCTION'
  | 'CLASS'
  | 'COMPONENT'
  | 'SERVICE'
  | 'DATABASE_TABLE'
  | 'API_ENDPOINT'
  | 'DEPENDENCY'
  | 'MEMORY'
  | 'DECISION'
  | 'PATTERN'
  | 'RULE'
  | 'DOCUMENT'
  | 'INCIDENT'
  | 'THREAT'
  | 'FINDING'
  | 'BOTTLENECK'
  | 'OPTIMIZATION'
  | 'TASK'
  | 'SESSION'
  /** Team memory architecture (local-first; cloud sync later) */
  | 'DEVELOPER'
  | 'TEAM'
  | 'ORGANIZATION';

/** Conceptual CodeNode kinds */
export type CodeNodeType = 'FILE' | 'FUNCTION' | 'CLASS' | 'MODULE' | 'COMPONENT' | 'SERVICE';

/** Conceptual ArchitectureNode kinds */
export type ArchitectureNodeType = 'DECISION' | 'PATTERN' | 'RULE' | 'PROJECT';

/** Conceptual KnowledgeNode kinds */
export type KnowledgeNodeType = 'MEMORY' | 'DOCUMENT' | 'INCIDENT';

/** Conceptual SecurityNode kinds */
export type SecurityNodeType = 'THREAT' | 'FINDING';

/** Conceptual PerformanceNode kinds */
export type PerformanceNodeType = 'BOTTLENECK' | 'OPTIMIZATION';

/** Conceptual WorkflowNode kinds */
export type WorkflowNodeType = 'TASK' | 'SESSION';

export interface GraphNode {
  id: string;
  projectId: string;
  type: GraphNodeType;
  name: string;
  path?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGraphNodeInput {
  id?: string;
  projectId: string;
  type: GraphNodeType;
  name: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export function createGraphNode(input: CreateGraphNodeInput): GraphNode {
  const now = new Date().toISOString();
  return {
    id: input.id ?? stableNodeId(input.projectId, input.type, input.name, input.path),
    projectId: input.projectId,
    type: input.type,
    name: input.name,
    path: input.path,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Deterministic id so re-analysis upserts cleanly. */
export function stableNodeId(
  projectId: string,
  type: GraphNodeType,
  name: string,
  path?: string,
): string {
  const key = `${projectId}|${type}|${path ?? ''}|${name}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, '0');
  return `n-${type.toLowerCase()}-${hex}-${slug(name).slice(0, 24)}`;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node';
}

export function isCodeNode(type: GraphNodeType): boolean {
  return (['FILE', 'FUNCTION', 'CLASS', 'MODULE', 'COMPONENT', 'SERVICE'] as GraphNodeType[]).includes(type);
}

export function isArchitectureNode(type: GraphNodeType): boolean {
  return (['DECISION', 'PATTERN', 'RULE', 'PROJECT'] as GraphNodeType[]).includes(type);
}

export function isKnowledgeNode(type: GraphNodeType): boolean {
  return (['MEMORY', 'DOCUMENT', 'INCIDENT'] as GraphNodeType[]).includes(type);
}

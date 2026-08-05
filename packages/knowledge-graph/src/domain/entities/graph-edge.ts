/**
 * Directed edge types in the project knowledge graph (Graph 2.0).
 */
export type GraphRelationType =
  | 'DEPENDS_ON'
  | 'IMPORTS'
  | 'CALLS'
  | 'USES'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'AFFECTS'
  | 'RELATED_TO'
  | 'REPLACED_BY'
  | 'REPLACES'
  | 'OWNED_BY'
  | 'CREATED_BY'
  | 'APPROVED_BY'
  | 'USED_BY'
  | 'MEMBER_OF'
  | 'CAUSED'
  | 'FIXED_BY'
  | 'VIOLATES'
  | 'DOCUMENTS';

export interface GraphEdge {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: GraphRelationType;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGraphEdgeInput {
  id?: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: GraphRelationType;
  metadata?: Record<string, unknown>;
}

export function createGraphEdge(input: CreateGraphEdgeInput): GraphEdge {
  const now = new Date().toISOString();
  const id =
    input.id ??
    `e-${input.relationType.toLowerCase()}-${hashShort(`${input.fromNodeId}->${input.toNodeId}`)}`;
  return {
    id,
    projectId: input.projectId,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    relationType: input.relationType,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

function hashShort(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

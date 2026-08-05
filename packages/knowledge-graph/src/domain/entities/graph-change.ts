export type GraphChangeKind =
  | 'node_upserted'
  | 'node_removed'
  | 'edge_upserted'
  | 'edge_removed'
  | 'snapshot';

export interface GraphChangeRecord {
  id: string;
  projectId: string;
  kind: GraphChangeKind;
  entityId: string;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function createGraphChange(
  input: Omit<GraphChangeRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
): GraphChangeRecord {
  return {
    id: input.id ?? `gc-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
    projectId: input.projectId,
    kind: input.kind,
    entityId: input.entityId,
    summary: input.summary,
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: input.metadata,
  };
}

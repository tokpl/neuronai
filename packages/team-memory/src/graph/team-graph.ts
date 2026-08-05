import type {
  LocalActor,
  TeamDocument,
  TeamGraphEdge,
  TeamGraphNode,
  TeamGraphRelation,
} from '../types.js';
import { newId } from '../types.js';

/**
 * Team Knowledge Graph overlay: Developer · Team · Project (+ memory links).
 */
export class TeamKnowledgeGraph {
  ensureBase(doc: TeamDocument): TeamDocument {
    const nodes = [...doc.graph.nodes];
    const edges = [...doc.graph.edges];

    upsertNode(nodes, {
      id: `project:${doc.projectId}`,
      type: 'PROJECT',
      name: doc.projectId,
      projectId: doc.projectId,
      metadata: {},
    });
    upsertNode(nodes, {
      id: `team:${doc.teamId}`,
      type: 'TEAM',
      name: doc.teamName,
      teamId: doc.teamId,
      projectId: doc.projectId,
      metadata: {},
    });
    link(edges, `team:${doc.teamId}`, `project:${doc.projectId}`, 'OWNS');

    for (const actor of doc.actors) {
      upsertNode(nodes, {
        id: `dev:${actor.id}`,
        type: 'DEVELOPER',
        name: actor.displayName,
        teamId: actor.teamId,
        projectId: doc.projectId,
        metadata: { role: actor.role },
      });
      link(edges, `dev:${actor.id}`, `team:${doc.teamId}`, 'MEMBER_OF');
    }

    return { ...doc, graph: { nodes, edges } };
  }

  recordCreatedBy(doc: TeamDocument, memoryId: string, actor: LocalActor, title: string): TeamDocument {
    let next = this.ensureBase(doc);
    const nodes = [...next.graph.nodes];
    const edges = [...next.graph.edges];
    const mid = `memory:${memoryId}`;
    upsertNode(nodes, {
      id: mid,
      type: 'MEMORY',
      name: title,
      projectId: doc.projectId,
      teamId: doc.teamId,
      metadata: { memoryId },
    });
    link(edges, mid, `dev:${actor.id}`, 'CREATED_BY');
    link(edges, mid, `project:${doc.projectId}`, 'USED_BY');
    next = { ...next, graph: { nodes, edges } };
    return next;
  }

  recordApprovedBy(doc: TeamDocument, memoryId: string, actor: LocalActor): TeamDocument {
    const edges = [...doc.graph.edges];
    link(edges, `memory:${memoryId}`, `dev:${actor.id}`, 'APPROVED_BY');
    return { ...doc, graph: { ...doc.graph, edges } };
  }

  recordUsedBy(doc: TeamDocument, memoryId: string, actor: LocalActor): TeamDocument {
    const edges = [...doc.graph.edges];
    link(edges, `memory:${memoryId}`, `dev:${actor.id}`, 'USED_BY');
    return { ...doc, graph: { ...doc.graph, edges } };
  }
}

function upsertNode(nodes: TeamGraphNode[], node: TeamGraphNode): void {
  const i = nodes.findIndex((n) => n.id === node.id);
  if (i >= 0) nodes[i] = { ...nodes[i]!, ...node, metadata: { ...nodes[i]!.metadata, ...node.metadata } };
  else nodes.push(node);
}

function link(
  edges: TeamGraphEdge[],
  fromNodeId: string,
  toNodeId: string,
  relation: TeamGraphRelation,
): void {
  const id = `${relation}:${fromNodeId}->${toNodeId}`;
  if (edges.some((e) => e.id === id)) return;
  edges.push({ id: id || newId('edge'), fromNodeId, toNodeId, relation, metadata: {} });
}

export function createTeamKnowledgeGraph(): TeamKnowledgeGraph {
  return new TeamKnowledgeGraph();
}

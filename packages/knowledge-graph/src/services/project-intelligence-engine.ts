import type { MemoryRecord } from '@neuronai/types';
import {
  collectProjectSignals,
  createProjectResolver,
  type ResolvedProject,
} from '@neuronai/project-analyzer';

import { createCodeGraphAnalyzer } from '../analyzers/code-graph-analyzer.js';
import { createDependencyScanner } from '../analyzers/dependency-scanner.js';
import { createGraphChange } from '../domain/entities/graph-change.js';
import { createGraphNode, type GraphNode } from '../domain/entities/graph-node.js';
import type { GraphEdge } from '../domain/entities/graph-edge.js';
import {
  createInMemoryGraphRepository,
  type InMemoryGraphRepository,
} from '../repositories/in-memory-graph-repository.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import { exportGraphJson, type GraphJsonExport } from '../export/graph-json-export.js';
import { createArchitectureQueryService } from './architecture-query.js';
import { createGraphSearchEngine } from './graph-search-engine.js';
import { createGraphUpdateEngine } from './graph-update-engine.js';
import { createImpactAnalyzer, type ImpactReport } from './impact-analyzer.js';
import { createMemoryGraphLinker } from './memory-graph-linker.js';
import { createGraphReasoner } from '../queries/graph-reasoner.js';
import { createNodeImportanceScorer } from '../ranking/importance.js';
import { writeGraphVisualization } from '../visualization/export.js';

export interface ProjectIntelligenceResult {
  project: ResolvedProject;
  projectNode: GraphNode;
  stats: {
    nodes: number;
    edges: number;
    modules: number;
    dependencies: number;
    files: number;
  };
  export: GraphJsonExport;
}

/**
 * Facade: resolve project → build/update knowledge graph → optional memory link.
 */
export class ProjectIntelligenceEngine {
  readonly graph: GraphRepository;
  readonly search;
  readonly impact;
  readonly query;
  readonly memories;
  readonly reasoner;
  readonly ranking;

  constructor(graph: GraphRepository = createInMemoryGraphRepository()) {
    this.graph = graph;
    this.search = createGraphSearchEngine(graph);
    this.impact = createImpactAnalyzer(graph);
    this.query = createArchitectureQueryService(graph);
    this.memories = createMemoryGraphLinker(graph);
    this.reasoner = createGraphReasoner(graph);
    this.ranking = createNodeImportanceScorer(graph);
  }

  async analyzeProject(
    rootPath: string,
    options: { memories?: MemoryRecord[] } = {},
  ): Promise<ProjectIntelligenceResult> {
    const project = await createProjectResolver().resolve(rootPath);
    const signals = await collectProjectSignals(project.rootPath);
    const projectNode = createGraphNode({
      projectId: project.projectId,
      type: 'PROJECT',
      name: project.name,
      path: project.rootPath,
      metadata: {
        stack: project.stack,
        languages: project.languages,
        frameworks: project.frameworks,
        databases: project.databases,
        documentationCount: signals.documentation.length,
        schemaFiles: signals.schemaFiles.slice(0, 20),
        recentCommits: signals.recentCommitSubjects,
      },
    });
    await this.graph.upsertNode(projectNode);

    const deps = createDependencyScanner(this.graph);
    const scanned = await deps.scan({
      projectId: project.projectId,
      rootPath: project.rootPath,
      projectNodeId: projectNode.id,
    });

    const code = createCodeGraphAnalyzer(this.graph);
    const codeStats = await code.analyze({
      projectId: project.projectId,
      rootPath: project.rootPath,
      projectNodeId: projectNode.id,
    });

    if (options.memories?.length) {
      await this.memories.linkMemories(project.projectId, options.memories);
    }

    await this.graph.appendChange(
      createGraphChange({
        projectId: project.projectId,
        kind: 'snapshot',
        entityId: projectNode.id,
        summary: `Project intelligence built for ${project.name}`,
      }),
    );

    const snapshot = await this.graph.exportProject(project.projectId);
    const modules = snapshot.nodes.filter((n) => n.type === 'MODULE');
    const dependencies = snapshot.nodes.filter((n) => n.type === 'DEPENDENCY');
    const files = snapshot.nodes.filter((n) => n.type === 'FILE');

    return {
      project,
      projectNode,
      stats: {
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        modules: modules.length,
        dependencies: dependencies.length || scanned.length,
        files: files.length || codeStats.files,
      },
      export: exportGraphJson(snapshot.nodes, snapshot.edges, {
        projectId: project.projectId,
        name: project.name,
      }),
    };
  }

  async impactAnalysis(projectId: string, target: string): Promise<ImpactReport | null> {
    return this.impact.analyze(projectId, target);
  }

  async ask(projectId: string, question: string) {
    return this.query.ask(projectId, question);
  }

  async graphQuery(projectId: string, question: string) {
    return this.reasoner.reason(projectId, question);
  }

  async relatedKnowledge(projectId: string, query: string, limit = 20) {
    return this.reasoner.relatedKnowledge(projectId, query, limit);
  }

  async projectMap(projectId: string, projectName?: string) {
    const snapshot = await this.graph.exportProject(projectId);
    const importance = await this.ranking.scoreProject(projectId, 30);
    const exported = exportGraphJson(snapshot.nodes, snapshot.edges, {
      projectId,
      name: projectName ?? projectId,
    });
    return {
      export: exported,
      stats: {
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        modules: snapshot.nodes.filter((n) => n.type === 'MODULE').length,
        decisions: snapshot.nodes.filter((n) => n.type === 'DECISION' || n.type === 'MEMORY').length,
      },
      topNodes: importance,
    };
  }

  async persistVisualization(dataDir: string, projectId: string, projectName?: string) {
    const map = await this.projectMap(projectId, projectName);
    const path = await writeGraphVisualization(dataDir, map.export);
    return { path, ...map };
  }

  createUpdater(ctx: { projectId: string; rootPath: string; projectNodeId: string }) {
    return createGraphUpdateEngine(this.graph, ctx);
  }
}

export function createProjectIntelligenceEngine(
  graph?: GraphRepository | InMemoryGraphRepository,
): ProjectIntelligenceEngine {
  return new ProjectIntelligenceEngine(graph);
}

export type { GraphEdge };

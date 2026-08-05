import { createGraphChange } from '../domain/entities/graph-change.js';
import type { GraphRepository } from '../repositories/graph-repository.js';
import { CodeGraphAnalyzer } from '../analyzers/code-graph-analyzer.js';
import { DependencyScanner } from '../analyzers/dependency-scanner.js';

export type GraphUpdateTrigger =
  | { kind: 'file_changed'; paths: string[] }
  | { kind: 'dependency_changed' }
  | { kind: 'architecture_changed'; summary: string }
  | { kind: 'git_commit'; message: string; files?: string[] }
  | { kind: 'full_rebuild' };

/**
 * Applies incremental / full graph updates and appends history records.
 */
export class GraphUpdateEngine {
  private readonly code: CodeGraphAnalyzer;
  private readonly deps: DependencyScanner;

  constructor(
    private readonly graph: GraphRepository,
    private readonly ctx: {
      projectId: string;
      rootPath: string;
      projectNodeId: string;
    },
  ) {
    this.code = new CodeGraphAnalyzer(graph);
    this.deps = new DependencyScanner(graph);
  }

  async apply(trigger: GraphUpdateTrigger): Promise<{ summary: string }> {
    switch (trigger.kind) {
      case 'dependency_changed':
      case 'full_rebuild': {
        await this.deps.scan(this.ctx);
        const stats = await this.code.analyze(this.ctx);
        const summary =
          trigger.kind === 'full_rebuild'
            ? `Full rebuild: ${stats.files} files, ${stats.modules} modules`
            : `Dependencies refreshed + code graph (${stats.files} files)`;
        await this.graph.appendChange(
          createGraphChange({
            projectId: this.ctx.projectId,
            kind: 'snapshot',
            entityId: this.ctx.projectNodeId,
            summary,
            metadata: { trigger },
          }),
        );
        return { summary };
      }
      case 'file_changed':
      case 'git_commit': {
        // MVP: re-run code analyzer (incremental AST later)
        const stats = await this.code.analyze(this.ctx);
        const summary =
          trigger.kind === 'git_commit'
            ? `Git commit update: ${trigger.message.slice(0, 80)} (${stats.files} files)`
            : `File changes: ${(trigger.paths ?? []).slice(0, 5).join(', ')}`;
        await this.graph.appendChange(
          createGraphChange({
            projectId: this.ctx.projectId,
            kind: 'snapshot',
            entityId: this.ctx.projectNodeId,
            summary,
            metadata: { trigger },
          }),
        );
        return { summary };
      }
      case 'architecture_changed': {
        await this.graph.appendChange(
          createGraphChange({
            projectId: this.ctx.projectId,
            kind: 'snapshot',
            entityId: this.ctx.projectNodeId,
            summary: `Architecture note: ${trigger.summary}`,
            metadata: { trigger },
          }),
        );
        return { summary: trigger.summary };
      }
      default:
        return { summary: 'noop' };
    }
  }
}

export function createGraphUpdateEngine(
  graph: GraphRepository,
  ctx: { projectId: string; rootPath: string; projectNodeId: string },
): GraphUpdateEngine {
  return new GraphUpdateEngine(graph, ctx);
}

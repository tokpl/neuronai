import type { GraphRepository } from '../repositories/graph-repository.js';
import { ImpactAnalyzer } from './impact-analyzer.js';
import { GraphSearchEngine } from './graph-search-engine.js';
import { MemoryGraphLinker } from './memory-graph-linker.js';

export interface ArchitectureAnswer {
  question: string;
  answer: string;
  nodeIds: string[];
  impactScore?: number;
}

/**
 * Answers high-level architecture questions using the graph (+ linked memories).
 */
export class ArchitectureQueryService {
  private readonly search: GraphSearchEngine;
  private readonly impact: ImpactAnalyzer;
  private readonly memories: MemoryGraphLinker;

  constructor(private readonly graph: GraphRepository) {
    this.search = new GraphSearchEngine(graph);
    this.impact = new ImpactAnalyzer(graph);
    this.memories = new MemoryGraphLinker(graph);
  }

  async ask(projectId: string, question: string): Promise<ArchitectureAnswer> {
    const q = question.toLowerCase();

    if (/zależy|depend|depends on|co zależy|what depends/i.test(question)) {
      const target = extractQuotedOrToken(question);
      const report = await this.impact.analyze(projectId, target);
      if (!report) {
        return {
          question,
          answer: `Could not resolve target "${target}" in the project graph.`,
          nodeIds: [],
        };
      }
      const deps = report.affected
        .filter((a) => a.distance <= 2)
        .slice(0, 12)
        .map((a) => a.node.name);
      return {
        question,
        answer: deps.length
          ? `${report.target.name} is connected to: ${deps.join(', ')}.`
          : `${report.target.name} has no strong dependents detected yet.`,
        nodeIds: [report.target.id, ...report.affected.map((a) => a.node.id)],
        impactScore: report.impactScore,
      };
    }

    if (/usuń|remove|library|bibliotek|ucierpi|break/i.test(question)) {
      const target = extractQuotedOrToken(question);
      const report = await this.impact.analyze(projectId, target);
      if (!report) {
        return { question, answer: `Unknown library/module "${target}".`, nodeIds: [] };
      }
      return {
        question,
        answer: `${report.summary} Impact score: ${report.impactScore}.`,
        nodeIds: [report.target.id, ...report.affected.map((a) => a.node.id)],
        impactScore: report.impactScore,
      };
    }

    if (/decyz|decision|memory|pamięć|dotyczy/i.test(question)) {
      const target = extractQuotedOrToken(question);
      const report = await this.impact.analyze(projectId, target);
      if (!report) {
        return { question, answer: `No graph node matched "${target}".`, nodeIds: [] };
      }
      const mems = await this.memories.memoriesForNode(projectId, report.target.id);
      const related = mems.length
        ? mems.map((m) => m.name).join('; ')
        : 'No linked memories yet — run memory linking after analyze.';
      return {
        question,
        answer: `Memories related to ${report.target.name}: ${related}`,
        nodeIds: [report.target.id, ...mems.map((m) => m.id)],
      };
    }

    if (/logowan|login|auth|authentication|jak działa/i.test(question)) {
      const authNodes = (await this.graph.findNodes({ projectId })).filter((n) =>
        /auth|login|session|permission|rbac/i.test(`${n.name} ${n.path ?? ''}`),
      );
      const mems: string[] = [];
      for (const node of authNodes.slice(0, 8)) {
        const linked = await this.memories.memoriesForNode(projectId, node.id);
        for (const m of linked) mems.push(m.name);
      }
      const modules = authNodes
        .filter((n) => n.type === 'MODULE' || n.type === 'SERVICE' || n.type === 'FILE')
        .map((n) => n.path ?? n.name)
        .slice(0, 10);
      return {
        question,
        answer: [
          modules.length
            ? `Login/auth-related surface: ${modules.join(', ')}.`
            : 'No auth-named modules detected in the graph yet.',
          mems.length ? `Related decisions/patterns: ${[...new Set(mems)].join('; ')}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        nodeIds: authNodes.map((n) => n.id),
      };
    }

    // Generic: project map summary
    const modules = await this.graph.findNodes({ projectId, type: 'MODULE' });
    const deps = await this.graph.findNodes({ projectId, type: 'DEPENDENCY' });
    void this.search;
    void q;
    return {
      question,
      answer: `Project graph has ${modules.length} modules and ${deps.length} dependencies. Ask about dependencies, impact, or auth for a focused answer.`,
      nodeIds: modules.slice(0, 10).map((m) => m.id),
    };
  }
}

function extractQuotedOrToken(question: string): string {
  const quoted = question.match(/["'`](.+?)["'`]/)?.[1];
  if (quoted) return quoted;
  const words = question.split(/\s+/).filter((w) => w.length > 2);
  // Prefer CamelCase / path-like tokens
  const fancy = words.find((w) => /[A-Z]/.test(w) || w.includes('/') || w.includes('.'));
  return fancy ?? words[words.length - 1] ?? question;
}

export function createArchitectureQueryService(
  graph: GraphRepository,
): ArchitectureQueryService {
  return new ArchitectureQueryService(graph);
}

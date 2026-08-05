import type { MemorySearchEngine } from '@neuron-ai-memory/ai-memory';
import type { ProjectIntelligenceEngine } from '@neuron-ai-memory/knowledge-graph';
import type { MemoryEngine } from '@neuron-ai-memory/memory-engine';
import type { MemoryRecord } from '@neuron-ai-memory/types';

import { ContextEngine, type AgentContext } from '../context/context-engine.js';
import { TaskAnalyzer } from '../context/task-analyzer.js';
import { resolveAgentMode, type AgentMode } from '../modes/agent-mode.js';
import { ImplementationPlanner } from '../planning/implementation-planner.js';
import { buildPreparationReport, type PreparationReport } from '../planning/preparation-report.js';
import { buildRecommendations, type AgentRecommendations } from '../recommendations/recommendation-engine.js';
import { ArchitectureReviewer, type ArchitectureReview } from '../review/architecture-reviewer.js';
import { ChangeRiskAnalyzer, type ChangeRiskReport } from '../risk/change-risk-analyzer.js';
import {
  SelfImprovementLoop,
  type SelfImprovementInput,
  type SelfImprovementResult,
} from '../reasoning/self-improvement.js';

export interface AgentIntelligenceSession {
  lastContext?: AgentContext;
  lastRecommendations?: AgentRecommendations;
  lastRisks?: ChangeRiskReport[];
  lastPlan?: PreparationReport['plan'];
  lastReview?: ArchitectureReview;
}

export interface AgentIntelligenceDeps {
  projectId: string;
  engine: MemoryEngine;
  searchEngine?: MemorySearchEngine;
  intelligence?: ProjectIntelligenceEngine;
  listMemories?: () => Promise<MemoryRecord[]>;
}

/**
 * Facade: senior-developer assistant over memory + knowledge graph.
 */
export class AgentIntelligence {
  readonly context: ContextEngine;
  readonly planner = new ImplementationPlanner();
  readonly tasks = new TaskAnalyzer();
  readonly risk: ChangeRiskAnalyzer;
  readonly reviewer: ArchitectureReviewer;
  readonly improve: SelfImprovementLoop;
  readonly session: AgentIntelligenceSession = {};

  constructor(private readonly deps: AgentIntelligenceDeps) {
    this.context = new ContextEngine(deps);
    this.risk = new ChangeRiskAnalyzer(deps.intelligence);
    this.reviewer = new ArchitectureReviewer(deps.intelligence);
    this.improve = new SelfImprovementLoop(deps.engine);
  }

  async prepareTask(task: string, mode?: AgentMode | string): Promise<PreparationReport> {
    const resolved = resolveAgentMode(mode);
    const ctx = await this.context.build(task, resolved);
    const plan =
      resolved === 'fast'
        ? undefined
        : this.planner.plan(ctx.task, ctx);
    const report = buildPreparationReport(ctx, plan);
    this.session.lastContext = ctx;
    this.session.lastPlan = plan;
    const risk = await this.risk.analyze(
      this.deps.projectId,
      task,
      await this.loadMemories(),
    );
    this.session.lastRisks = [risk];
    this.session.lastRecommendations = buildRecommendations({ context: ctx, risk });
    return report;
  }

  async reviewArchitecture(changeDescription: string): Promise<ArchitectureReview> {
    const review = await this.reviewer.review({
      projectId: this.deps.projectId,
      changeDescription,
      context: this.session.lastContext,
      memories: await this.loadMemories(),
    });
    this.session.lastReview = review;
    this.session.lastRecommendations = buildRecommendations({
      context: this.session.lastContext,
      risk: review.risk,
      review,
    });
    if (review.risk) {
      this.session.lastRisks = [review.risk];
    }
    return review;
  }

  async analyzeImpact(target: string) {
    if (!this.deps.intelligence) {
      const risk = await this.risk.analyze(this.deps.projectId, target, await this.loadMemories());
      this.session.lastRisks = [risk];
      return { kind: 'risk' as const, risk };
    }
    const impact = await this.deps.intelligence.impactAnalysis(this.deps.projectId, target);
    if (impact) {
      this.session.lastRisks = [
        {
          change: target,
          level: impact.impactScore >= 0.65 ? 'HIGH' : impact.impactScore >= 0.4 ? 'MEDIUM' : 'LOW',
          score: impact.impactScore,
          reasons: [impact.summary],
          affects: impact.affected.map((a) => a.node.name),
        },
      ];
    }
    return { kind: 'impact' as const, impact };
  }

  async generatePlan(featureRequest: string, mode?: AgentMode | string) {
    const report = await this.prepareTask(featureRequest, mode ?? 'standard');
    return report.plan ?? this.planner.plan(report.context.task, report.context);
  }

  async projectQuestion(question: string) {
    if (this.deps.intelligence) {
      return this.deps.intelligence.ask(this.deps.projectId, question);
    }
    const ctx = await this.context.build(question, 'standard');
    return {
      question,
      answer: ctx.briefing,
      nodeIds: [],
    };
  }

  async graphQuery(question: string) {
    if (!this.deps.intelligence) {
      return this.projectQuestion(question);
    }
    return this.deps.intelligence.graphQuery(this.deps.projectId, question);
  }

  async relatedKnowledge(query: string, limit = 20) {
    if (!this.deps.intelligence) {
      return { seed: null, nodes: [], memories: [] };
    }
    return this.deps.intelligence.relatedKnowledge(this.deps.projectId, query, limit);
  }

  async projectGraphMap() {
    if (!this.deps.intelligence) {
      return null;
    }
    return this.deps.intelligence.projectMap(this.deps.projectId, this.deps.projectId);
  }

  async completeTask(input: Omit<SelfImprovementInput, 'projectId'>): Promise<SelfImprovementResult> {
    return this.improve.run({
      ...input,
      projectId: this.deps.projectId,
      context: input.context ?? this.session.lastContext,
      plan: input.plan ?? this.session.lastPlan,
      review: input.review ?? this.session.lastReview,
    });
  }

  private async loadMemories(): Promise<MemoryRecord[]> {
    if (this.deps.listMemories) return this.deps.listMemories();
    const ctx = await this.deps.engine.getProjectMemoryContext({
      projectId: this.deps.projectId,
      limit: 100,
      maxTokens: 40_000,
    });
    return ctx.memories;
  }
}

export function createAgentIntelligence(deps: AgentIntelligenceDeps): AgentIntelligence {
  return new AgentIntelligence(deps);
}

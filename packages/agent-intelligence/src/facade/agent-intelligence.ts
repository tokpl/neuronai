import {
  createBrainCompiler,
  resolvePreparationMode,
  type CompiledBrainPrompt,
} from '@neuronai/brain';
import type { MemorySearchEngine } from '@neuronai/ai-memory';
import type { ProjectIntelligenceEngine } from '@neuronai/knowledge-graph';
import type { MemoryEngine } from '@neuronai/memory-engine';
import type { MemoryRecord } from '@neuronai/types';

import { ContextEngine, type AgentContext } from '../context/context-engine.js';
import { TaskAnalyzer } from '../context/task-analyzer.js';
import {
  agentModeForPreparation,
  resolveAgentMode,
  type AgentMode,
} from '../modes/agent-mode.js';
import { ImplementationPlanner } from '../planning/implementation-planner.js';
import { type PreparationReport } from '../planning/preparation-report.js';
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
  lastCompiled?: CompiledBrainPrompt;
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
 * Prompt path goes through BrainCompiler (Internal Brain ≠ Prompt).
 */
export class AgentIntelligence {
  readonly context: ContextEngine;
  readonly planner = new ImplementationPlanner();
  readonly tasks = new TaskAnalyzer();
  readonly risk: ChangeRiskAnalyzer;
  readonly reviewer: ArchitectureReviewer;
  readonly improve: SelfImprovementLoop;
  readonly session: AgentIntelligenceSession = {};
  private readonly compiler = createBrainCompiler();

  constructor(private readonly deps: AgentIntelligenceDeps) {
    this.context = new ContextEngine(deps);
    this.risk = new ChangeRiskAnalyzer(deps.intelligence);
    this.reviewer = new ArchitectureReviewer(deps.intelligence);
    this.improve = new SelfImprovementLoop(deps.engine);
  }

  async prepareTask(task: string, mode?: AgentMode | string): Promise<PreparationReport> {
    const prep = resolvePreparationMode(mode);
    const agentMode = mode === 'debug' || prep.debug ? ('debug' as const) : agentModeForPreparation(prep.mode);
    const ctx = await this.context.build(task, agentMode);

    const plan = prep.includePlan ? this.planner.plan(ctx.task, ctx) : undefined;

    let riskReport: ChangeRiskReport | undefined;
    if (prep.includeRisks) {
      riskReport = await this.risk.analyze(
        this.deps.projectId,
        task,
        await this.loadMemories(),
      );
      this.session.lastRisks = [riskReport];
      this.session.lastRecommendations = buildRecommendations({
        context: ctx,
        risk: riskReport,
      });
    } else {
      this.session.lastRisks = undefined;
      this.session.lastRecommendations = undefined;
    }

    const compiled = this.compiler.compile({
      task,
      mode: prep.debug ? 'debug' : prep.mode,
      debug: prep.debug,
      modules: ctx.relatedModules,
      architectureNotes: ctx.architectureNotes.filter(
        (n) => !/^Involves area\/module:/i.test(n),
      ),
      decisions: ctx.decisions.map((d) => ({
        id: d.id,
        kind: 'decision' as const,
        title: d.title,
        content: d.content,
        score: d.score,
      })),
      patterns: ctx.patterns.map((p) => ({
        id: p.id,
        kind: 'pattern' as const,
        title: p.title,
        content: p.content,
        score: p.score,
      })),
      warnings: ctx.warnings,
      hints: prep.includeHints
        ? [
            ...ctx.patterns.slice(0, 3).map((p) => p.title),
            ...(ctx.impactSummary ? [ctx.impactSummary] : []),
          ]
        : [],
      planSteps: plan?.steps.map((s) => `${s.title}: ${s.detail}`),
      risks: riskReport
        ? [
            `${riskReport.level}: ${riskReport.change}`,
            ...riskReport.reasons,
            ...(riskReport.affects.length
              ? [`Affects: ${riskReport.affects.slice(0, 6).join(', ')}`]
              : []),
          ]
        : [],
    });

    // Keep internal briefing free of ranking scores for any accidental leakage
    ctx.briefing = compiled.prompt;

    this.session.lastContext = ctx;
    this.session.lastPlan = plan;
    this.session.lastCompiled = compiled;

    return {
      prompt: compiled.prompt,
      markdown: compiled.prompt,
      compiled,
      context: ctx,
      plan,
    };
  }

  explainLastInclusion(titleOrId: string): string {
    if (!this.session.lastCompiled) {
      return 'No compiled prompt in session. Call prepareTask first.';
    }
    return this.compiler.explainInclusion(this.session.lastCompiled, titleOrId);
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
    const report = await this.prepareTask(featureRequest, mode ?? 'deep');
    return report.plan ?? this.planner.plan(report.context.task, report.context);
  }

  async projectQuestion(question: string) {
    if (this.deps.intelligence) {
      return this.deps.intelligence.ask(this.deps.projectId, question);
    }
    const ctx = await this.context.build(question, resolveAgentMode('standard'));
    this.session.lastContext = ctx;
    return {
      question,
      answer: ctx.briefing,
      nodeIds: [] as string[],
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

  async selfImprove(input: SelfImprovementInput): Promise<SelfImprovementResult> {
    return this.improve.run(input);
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

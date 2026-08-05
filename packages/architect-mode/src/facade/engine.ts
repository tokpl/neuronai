import { createAdrGenerator } from '../decisions/adr.js';
import { createSolutionDesigner } from '../design/solution-designer.js';
import { createArchitectModeResolver } from '../modes/resolver.js';
import { createImplementationPlanner } from '../planning/planner.js';
import { renderArchitectReport } from '../reports/proposal.js';
import { createRequirementAnalyzer } from '../requirements/analyzer.js';
import { createImplementationReviewer } from '../review/implementation-reviewer.js';
import { createArchitectureRiskAnalyzer } from '../risk/analyzer.js';
import { createDependencyImpactAnalyzer } from '../risk/impact.js';
import { createArchitectureScore } from '../score/score.js';
import type {
  ArchitectReport,
  ArchitectSessionInput,
  ArchitectureDecisionRecord,
  ImplementationPlan,
} from '../types.js';
import { nowIso } from '../types.js';

/**
 * Architect Mode facade — analyzes and plans; never writes application code.
 */
export class ArchitectModeEngine {
  private readonly modes = createArchitectModeResolver();
  private readonly requirements = createRequirementAnalyzer();
  private readonly designer = createSolutionDesigner();
  private readonly planner = createImplementationPlanner();
  private readonly risk = createArchitectureRiskAnalyzer();
  private readonly impact = createDependencyImpactAnalyzer();
  private readonly adr = createAdrGenerator();
  private readonly reviewer = createImplementationReviewer();
  private readonly score = createArchitectureScore();

  run(input: ArchitectSessionInput): ArchitectReport {
    const mode = this.modes.resolve(input.mode, input.request);
    const requirement = this.requirements.analyze(input.request, input.memory);
    const proposal = this.designer.design(requirement, input.memory);
    const plan = this.planner.plan(requirement);
    const risk = this.risk.analyze(requirement, input.memory);
    const impact = this.impact.analyze(requirement, input.memory);
    const adr = this.adr.generate(requirement, proposal, risk);

    let review = undefined;
    let scoreSnap = undefined;

    if (mode === 'REVIEW' || input.changeSummary || input.changedPaths?.length) {
      review = this.reviewer.review({
        changeSummary: input.changeSummary,
        changedPaths: input.changedPaths,
        priorPlan: input.priorPlan ?? plan,
        memory: input.memory,
      });
      scoreSnap = this.score.compare({
        before: input.scoreBefore ?? 72,
        review,
        risk,
        betterSeparation: review.architectureCompliance >= 0.75,
      });
    } else if (mode === 'ARCHITECT') {
      scoreSnap = this.score.compare({
        before: input.scoreBefore ?? 72,
        betterSeparation: proposal.recommendedOptionId === 'A',
        risk,
      });
    }

    const report: ArchitectReport = {
      mode,
      requirement,
      proposal,
      plan,
      risk,
      impact,
      adr,
      review,
      score: scoreSnap,
      markdown: '',
      generatedAt: nowIso(),
    };
    report.markdown = renderArchitectReport(report);
    return report;
  }

  createPlan(request: string, memory?: ArchitectSessionInput['memory']): ImplementationPlan {
    const requirement = this.requirements.analyze(request, memory);
    return this.planner.plan(requirement);
  }

  generateAdr(input: ArchitectSessionInput): ArchitectureDecisionRecord {
    return this.run(input).adr;
  }

  reviewChange(input: ArchitectSessionInput) {
    return this.run({ ...input, mode: 'REVIEW' });
  }

  compareArchitecture(input: ArchitectSessionInput) {
    const report = this.run({ ...input, mode: input.mode ?? 'REVIEW' });
    return report.score ?? this.score.compare({ before: input.scoreBefore ?? 72 });
  }

  isMajorFeature(request: string): boolean {
    return this.modes.isMajorFeature(request);
  }
}

export function createArchitectModeEngine(): ArchitectModeEngine {
  return new ArchitectModeEngine();
}

export type {
  ConstitutionRule,
  DecisionEvolutionEntry,
  MistakeRecord,
  ProjectConstitutionDocument,
  RuleCategory,
  RuleSeverity,
  RuleSource,
  RuleStatus,
  TechDebtItem,
} from './rules/types.js';
export { createEmptyConstitution, newRuleId } from './rules/types.js';

export { RuleGenerator, createRuleGenerator, type RuleSuggestion } from './generators/rule-generator.js';
export {
  BASELINE_SECURITY_RULES,
  buildBaselineSecurityRuleCandidates,
  suggestBaselineSecurityRules,
} from './generators/security-rules.js';
export { PatternMiner, createPatternMiner, type MinedPattern } from './generators/pattern-miner.js';
export { MistakeMemorySystem, createMistakeMemorySystem } from './generators/mistake-memory.js';
export {
  DecisionEvolutionTracker,
  createDecisionEvolutionTracker,
} from './generators/decision-evolution.js';
export { TechnicalDebtMemory, createTechnicalDebtMemory } from './generators/tech-debt.js';
export {
  renderConstitutionMarkdown,
  renderCursorArchitectureRule,
  createCursorRulesFromConstitution,
} from './generators/cursor-rules.js';

export { RuleApprovalFlow, createRuleApprovalFlow } from './validators/approval-flow.js';
export { validateRuleCandidate, assertCanActivate } from './validators/rule-validator.js';

export {
  ProjectHealthAnalyzer,
  createProjectHealthAnalyzer,
  type ProjectHealthReport,
} from './evolution/project-health.js';
export {
  PeriodicReview,
  createPeriodicReview,
  type EvolutionReview,
} from './evolution/periodic-review.js';

export {
  ConstitutionFileRepository,
  createConstitutionRepository,
} from './repositories/file-repository.js';

export {
  ProjectConstitutionService,
  createProjectConstitutionService,
} from './facade/constitution-service.js';

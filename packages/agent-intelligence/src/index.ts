export {
  resolveAgentMode,
  getAgentModeProfile,
  type AgentMode,
  type AgentModeProfile,
} from './modes/agent-mode.js';

export {
  TaskAnalyzer,
  createTaskAnalyzer,
  type AnalyzedTask,
  type TaskType,
} from './context/task-analyzer.js';
export {
  ContextRanker,
  createContextRanker,
  type RankedContextItem,
  type RankableMemory,
} from './context/context-ranker.js';
export {
  ContextEngine,
  createContextEngine,
  type AgentContext,
  type ContextEngineDeps,
} from './context/context-engine.js';

export {
  ImplementationPlanner,
  createImplementationPlanner,
  type ImplementationPlan,
} from './planning/implementation-planner.js';
export {
  buildPreparationReport,
  type PreparationReport,
} from './planning/preparation-report.js';

export {
  ChangeRiskAnalyzer,
  createChangeRiskAnalyzer,
  type ChangeRiskReport,
  type RiskLevel,
} from './risk/change-risk-analyzer.js';

export {
  ArchitectureReviewer,
  createArchitectureReviewer,
  type ArchitectureReview,
} from './review/architecture-reviewer.js';

export {
  SelfImprovementLoop,
  createSelfImprovementLoop,
  type SelfImprovementInput,
  type SelfImprovementResult,
} from './reasoning/self-improvement.js';

export {
  buildRecommendations,
  type AgentRecommendations,
} from './recommendations/recommendation-engine.js';

export {
  AgentIntelligence,
  createAgentIntelligence,
  type AgentIntelligenceDeps,
  type AgentIntelligenceSession,
} from './facade/agent-intelligence.js';

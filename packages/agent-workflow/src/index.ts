export {
  CodeChangeAnalyzer,
  createCodeChangeAnalyzer,
  type CodeChangeAnalysis,
  type ChangeKind,
  type FileChange,
} from './analysis/code-change-analyzer.js';

export {
  WorkflowRulesEngine,
  createWorkflowRulesEngine,
  defaultWorkflowRules,
  type WorkflowRule,
  type WorkflowRuleHit,
  type WorkflowRuleContext,
} from './suggestion/workflow-rules.js';
export {
  MemorySuggestionEngine,
  createMemorySuggestionEngine,
  type MemorySuggestion,
  type SuggestionInput,
} from './suggestion/memory-suggestion-engine.js';
export {
  formatSuggestionMessage,
  type UserPromptMessage,
  type SuggestionUserAction,
  type SuggestionAskQuestion,
  type SuggestionAskQuestionOption,
} from './suggestion/user-messages.js';

export {
  MemoryQualityChecker,
  createMemoryQualityChecker,
  type QualityCheckInput,
  type QualityCheckResult,
} from './quality/memory-quality-checker.js';

export {
  DEFAULT_PRIVACY_MODE,
  parsePrivacyMode,
  createPrivacyPolicy,
  shouldEmitSuggestion,
  shouldAutoPersist,
  type PrivacyMode,
  type PrivacyPolicy,
} from './privacy/privacy-mode.js';

export {
  AgentWorkflowOrchestrator,
  createAgentWorkflow,
  type AgentWorkflowDeps,
  type AfterCodingResult,
} from './lifecycle/agent-workflow-orchestrator.js';

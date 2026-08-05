export type {
  NeuronEvent,
  NeuronEventType,
  NeuronEventSource,
  EventBus,
  EventHandler,
} from './events/types.js';
export { createNeuronEvent } from './events/types.js';
export { InMemoryEventBus, createEventBus } from './events/event-bus.js';
export { DomainEvents } from './events/domain-events.js';
export type {
  AgentStartedTaskPayload,
  CodeChangedPayload,
  GitCommittedPayload,
  TaskCompletedPayload,
} from './events/domain-events.js';

export {
  CodeChangeAnalyzer,
  createCodeChangeAnalyzer,
  type CodeChangeAnalysis,
  type ChangeKind,
  type FileChange,
} from './analysis/code-change-analyzer.js';
export {
  GitMemoryAnalyzer,
  createGitMemoryAnalyzer,
  type GitCommitInfo,
  type GitAnalysisResult,
} from './analysis/git-memory-analyzer.js';

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
  createHookRegistry,
  runHooks,
  type HookRegistry,
  type BeforeTaskHook,
  type AfterTaskHook,
  type BeforeCommitHook,
  type AfterCommitHook,
  type BeforeTaskHookInput,
  type AfterTaskHookInput,
  type BeforeCommitHookInput,
  type AfterCommitHookInput,
} from './hooks/hook-interfaces.js';

export {
  AgentWorkflowOrchestrator,
  createAgentWorkflow,
  type AgentWorkflowDeps,
  type AgentTaskSession,
  type AfterCodingResult,
} from './lifecycle/agent-workflow-orchestrator.js';

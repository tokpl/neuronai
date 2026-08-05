export type {
  MemoryScope,
  PermissionAction,
  TeamRole,
  DecisionReviewStatus,
  AuditAction,
  TeamGraphNodeType,
  TeamGraphRelation,
  LocalActor,
  MemoryPermission,
  ScopedMemoryRecord,
  KnowledgeContribution,
  MemoryAuditEntry,
  TeamGraphNode,
  TeamGraphEdge,
  TeamDocument,
} from './types.js';
export { nowIso, newId } from './types.js';

export {
  MEMORY_SCOPES,
  describeScope,
  defaultScopeForDecision,
  parseScope,
} from './scope/scopes.js';

export {
  DEFAULT_PERMISSIONS,
  PermissionGate,
  createPermissionGate,
  isSharedScope,
  scopeRank,
} from './permissions/gate.js';

export { TeamKnowledgeGraph, createTeamKnowledgeGraph } from './graph/team-graph.js';

export { MemoryAuditLog, createMemoryAuditLog } from './audit/audit-log.js';
export { ContributionTracker, createContributionTracker } from './contribution/tracker.js';
export {
  DecisionReviewWorkflow,
  createDecisionReviewWorkflow,
} from './workflow/decision-review.js';
export { OnboardingEngine, createOnboardingEngine, type OnboardingPack } from './onboarding/engine.js';
export {
  TeamRetrievalScorer,
  createTeamRetrievalScorer,
  type TeamRetrievalHit,
} from './retrieval/team-scorer.js';

export {
  TeamMemoryStore,
  createTeamMemoryStore,
  emptyTeamDocument,
  resolveLocalActor,
} from './store/file-store.js';

export {
  TeamMemoryService,
  createTeamMemoryService,
  type TeamMemoryServiceOptions,
} from './facade/team-memory-service.js';

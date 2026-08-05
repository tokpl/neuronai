export type {
  KnowledgePermissionLevel,
  SharedMemoryType,
  ApprovalStatus,
  Visibility,
  SyncMode,
  TeamMember,
  MemoryOwnership,
  SharedMemoryHistoryEntry,
  SharedMemory,
  TeamBrainModel,
  KnowledgeConflict,
  TimelineEvent,
  OnboardingBundle,
  AuditLogEntry,
  TeamBrainDocument,
} from './types.js';
export { nowIso, newId, PERMISSION_RANK } from './types.js';

export {
  KnowledgePermissions,
  createKnowledgePermissions,
} from './permissions/knowledge-permissions.js';
export {
  MemoryOwnershipService,
  createMemoryOwnershipService,
} from './ownership/memory-ownership.js';
export {
  MemoryApprovalFlow,
  createMemoryApprovalFlow,
} from './shared-memory/approval-flow.js';
export {
  TeamKnowledgeConflictResolver,
  createTeamKnowledgeConflictResolver,
} from './shared-memory/conflict-resolver.js';
export { toSharedMemory, mapTypeToShared } from './shared-memory/mapper.js';
export {
  TeamEngineeringTimeline,
  createTeamEngineeringTimeline,
} from './members/timeline.js';
export {
  NewDeveloperMode,
  createNewDeveloperMode,
} from './members/new-developer-mode.js';
export {
  KnowledgeAuditLog,
  createKnowledgeAuditLog,
} from './audit/knowledge-audit-log.js';
export {
  createKnowledgeSyncProvider,
  LocalOnlySyncProvider,
  SelfHostedSyncProvider,
  type KnowledgeSyncProvider,
  type SyncResult,
} from './sync/knowledge-sync.js';
export { TeamBrain, createTeamBrain, type TeamBrainOptions } from './facade/team-brain.js';

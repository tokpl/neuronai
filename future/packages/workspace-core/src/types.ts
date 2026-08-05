/** Enterprise foundation types — architecture only, no SaaS billing/accounts. */

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export type DeploymentMode = 'LOCAL' | 'SELF_HOSTED' | 'ENTERPRISE';

export type AccessResource =
  | 'memory'
  | 'documents'
  | 'decisions'
  | 'security_reports'
  | 'workspace_settings'
  | 'members';

export type AccessEffect = 'allow' | 'deny';

export interface WorkspaceSettings {
  defaultProjectId?: string;
  privacyMode?: 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ALLOWED';
  deploymentMode: DeploymentMode;
  storageBackend: 'sqlite' | 'postgres' | 'file' | 'memory';
}

export interface WorkspaceMember {
  id: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface ProjectIsolation {
  memorySpaceId: string;
  knowledgeGraphId: string;
  configScope: string;
  securityPolicyId: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  workspaceId: string;
  rootPath?: string;
  isolation: ProjectIsolation;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  organizationId?: string;
  projects: string[];
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: string;
}

export interface OrganizationSecuritySettings {
  requireMfaHint: boolean;
  allowCloudAi: boolean;
  auditRetentionDays: number;
}

export interface Organization {
  id: string;
  name: string;
  workspaces: string[];
  policies: string[];
  securitySettings: OrganizationSecuritySettings;
  createdAt: string;
}

export interface AccessPolicyRule {
  id: string;
  role: WorkspaceRole;
  resource: AccessResource;
  effect: AccessEffect;
}

export interface AccessPolicy {
  id: string;
  workspaceId: string;
  rules: AccessPolicyRule[];
}

export interface WorkspaceScopedKeys {
  workspaceId: string;
  projectId: string;
}

export interface UnifiedAuditEntry {
  id: string;
  who: string;
  what: string;
  when: string;
  where: {
    workspaceId?: string;
    projectId?: string;
    organizationId?: string;
  };
  source: 'security' | 'team' | 'workspace';
  details?: Record<string, unknown>;
}

export interface EnvironmentConfig {
  deploymentMode: DeploymentMode;
  storageBackend: WorkspaceSettings['storageBackend'];
  databaseUrl?: string;
  authMode: 'none' | 'local' | 'oidc_future';
  dataRoot: string;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
}

export interface WorkspaceStoreDocument {
  version: 1;
  organization?: Organization;
  workspaces: Workspace[];
  projects: WorkspaceProject[];
  policies: AccessPolicy[];
  active: {
    workspaceId?: string;
    projectId?: string;
    memberId?: string;
  };
  audit: UnifiedAuditEntry[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultIsolation(workspaceId: string, projectId: string): ProjectIsolation {
  return {
    memorySpaceId: `mem:${workspaceId}:${projectId}`,
    knowledgeGraphId: `kg:${workspaceId}:${projectId}`,
    configScope: `cfg:${workspaceId}:${projectId}`,
    securityPolicyId: `sec:${workspaceId}:${projectId}`,
  };
}

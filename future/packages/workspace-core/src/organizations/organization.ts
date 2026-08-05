import type {
  Organization,
  OrganizationSecuritySettings,
  Workspace,
  WorkspaceMember,
  WorkspaceProject,
  WorkspaceSettings,
} from '../types.js';
import { defaultIsolation, newId, nowIso } from '../types.js';
import { defaultAccessRules } from '../roles/access-policy.js';

export interface CreateOrganizationInput {
  name: string;
  securitySettings?: Partial<OrganizationSecuritySettings>;
}

export function createOrganization(input: CreateOrganizationInput): Organization {
  return {
    id: newId('org'),
    name: input.name,
    workspaces: [],
    policies: [],
    securitySettings: {
      requireMfaHint: false,
      allowCloudAi: false,
      auditRetentionDays: 90,
      ...input.securitySettings,
    },
    createdAt: nowIso(),
  };
}

export interface CreateWorkspaceInput {
  name: string;
  organizationId?: string;
  settings?: Partial<WorkspaceSettings>;
  owner?: { id: string; displayName: string };
}

export function createWorkspace(input: CreateWorkspaceInput): {
  workspace: Workspace;
  policy: ReturnType<typeof defaultAccessRules>;
} {
  const id = newId('ws');
  const owner: WorkspaceMember = {
    id: input.owner?.id ?? 'local-owner',
    displayName: input.owner?.displayName ?? 'Local Owner',
    role: 'OWNER',
    joinedAt: nowIso(),
  };
  const workspace: Workspace = {
    id,
    name: input.name,
    organizationId: input.organizationId,
    projects: [],
    members: [owner],
    settings: {
      deploymentMode: 'LOCAL',
      storageBackend: 'file',
      privacyMode: 'LOCAL_ONLY',
      ...input.settings,
    },
    createdAt: nowIso(),
  };
  return { workspace, policy: defaultAccessRules(id) };
}

export interface CreateProjectInput {
  name: string;
  workspaceId: string;
  rootPath?: string;
}

export function createWorkspaceProject(input: CreateProjectInput): WorkspaceProject {
  const id = newId('proj');
  return {
    id,
    name: input.name,
    workspaceId: input.workspaceId,
    rootPath: input.rootPath,
    isolation: defaultIsolation(input.workspaceId, id),
    createdAt: nowIso(),
  };
}

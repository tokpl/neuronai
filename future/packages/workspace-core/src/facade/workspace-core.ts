import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createOrganization,
  createWorkspace,
  createWorkspaceProject,
} from '../organizations/organization.js';
import {
  createAccessPolicyEngine,
  type AccessPolicyEngine,
} from '../roles/access-policy.js';
import {
  createProjectIsolationManager,
  type ProjectIsolationManager,
} from '../projects/isolation.js';
import {
  createStorageProvider,
  type StorageProvider,
} from '../storage/provider.js';
import {
  createDeploymentModeResolver,
  createEnvironmentConfigLoader,
} from '../deployment/environment.js';
import { createUnifiedWorkspaceAudit } from '../workspace/audit-bridge.js';
import { createWorkspaceRegistry } from '../workspace/registry.js';
import { WorkspaceContextResolver } from '../workspace/context-resolver.js';
import type {
  AccessPolicy,
  AccessResource,
  DeploymentMode,
  EnvironmentConfig,
  Organization,
  UnifiedAuditEntry,
  Workspace,
  WorkspaceProject,
  WorkspaceRole,
  WorkspaceStoreDocument,
} from '../types.js';
import { nowIso } from '../types.js';

const STORE_FILE = 'workspace.json';

export interface ResolvedSwitch {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  isolation: ReturnType<ProjectIsolationManager['describe']>;
}

/**
 * Enterprise architecture foundation (no SaaS billing / public accounts).
 */
export class WorkspaceCore {
  readonly registry = createWorkspaceRegistry();
  readonly isolation = createProjectIsolationManager();
  readonly audit = createUnifiedWorkspaceAudit();
  readonly envLoader = createEnvironmentConfigLoader();
  readonly deployment = createDeploymentModeResolver();

  private organization?: Organization;
  private policies = new Map<string, AccessPolicyEngine>();
  private active: {
    workspaceId?: string;
    projectId?: string;
    memberId?: string;
  } = {};
  private storage: StorageProvider = createStorageProvider('memory');
  private env: EnvironmentConfig = this.envLoader.fromProcessEnv();

  private resolver = new WorkspaceContextResolver(
    (id) => this.registry.getWorkspace(id),
    (id) => this.registry.getProject(id),
    (wid) => this.registry.listProjects(wid),
    () => this.registry.listWorkspaces(),
    (wid) => this.policies.get(wid),
    () => this.active,
  );

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, STORE_FILE), 'utf8'),
      ) as WorkspaceStoreDocument;
      this.organization = raw.organization;
      this.registry.loadState(raw.workspaces ?? [], raw.projects ?? []);
      this.active = raw.active ?? {};
      this.audit.load(raw.audit ?? []);
      for (const p of raw.policies ?? []) {
        this.policies.set(p.workspaceId, createAccessPolicyEngine(p));
      }
      const ws = this.active.workspaceId
        ? this.registry.getWorkspace(this.active.workspaceId)
        : this.registry.listWorkspaces()[0];
      if (ws) {
        this.storage = createStorageProvider(ws.settings.storageBackend, {
          databaseUrl: this.env.databaseUrl,
        });
        this.env = {
          ...this.env,
          deploymentMode: ws.settings.deploymentMode,
          storageBackend: ws.settings.storageBackend,
          workspaceId: ws.id,
          projectId: this.active.projectId,
          organizationId: this.organization?.id,
        };
      }
    } catch {
      /* empty foundation */
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const snap = this.registry.snapshot();
    const doc: WorkspaceStoreDocument = {
      version: 1,
      organization: this.organization,
      workspaces: snap.workspaces,
      projects: snap.projects,
      policies: [...this.policies.values()].map((e) => e.getPolicy()),
      active: this.active,
      audit: this.audit.snapshot().slice(0, 200),
      updatedAt: nowIso(),
    };
    const path = join(neuronDir, STORE_FILE);
    await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return path;
  }

  applyEnvironment(config?: Partial<EnvironmentConfig>): EnvironmentConfig {
    this.env = { ...this.envLoader.fromProcessEnv(process.env, config), ...config };
    this.storage = createStorageProvider(this.env.storageBackend, {
      databaseUrl: this.env.databaseUrl,
    });
    return { ...this.env };
  }

  getEnvironment(): EnvironmentConfig {
    return { ...this.env };
  }

  getStorage(): StorageProvider {
    return this.storage;
  }

  getOrganization(): Organization | undefined {
    return this.organization;
  }

  /**
   * Company → many projects under one workspace.
   * Example: Backend API, Mobile App, Website.
   */
  bootstrapCompany(input: {
    companyName: string;
    workspaceName?: string;
    projects: Array<{ name: string; rootPath?: string }>;
    owner?: { id: string; displayName: string };
    deploymentMode?: DeploymentMode;
  }): {
    organization: Organization;
    workspace: Workspace;
    projects: WorkspaceProject[];
  } {
    const organization = createOrganization({ name: input.companyName });
    const { workspace, policy } = createWorkspace({
      name: input.workspaceName ?? `${input.companyName} Workspace`,
      organizationId: organization.id,
      owner: input.owner,
      settings: {
        deploymentMode: input.deploymentMode ?? 'LOCAL',
        storageBackend: this.env.storageBackend,
      },
    });
    organization.workspaces.push(workspace.id);
    this.organization = organization;
    this.registry.upsertWorkspace(workspace);
    this.policies.set(workspace.id, createAccessPolicyEngine(policy));

    const projects: WorkspaceProject[] = [];
    for (const p of input.projects) {
      const project = createWorkspaceProject({
        name: p.name,
        workspaceId: workspace.id,
        rootPath: p.rootPath,
      });
      this.registry.upsertProject(project);
      projects.push(project);
    }

    if (projects[0]) {
      const withDefault: Workspace = {
        ...workspace,
        settings: { ...workspace.settings, defaultProjectId: projects[0].id },
        projects: projects.map((p) => p.id),
      };
      this.registry.upsertWorkspace(withDefault);
      this.active = {
        workspaceId: withDefault.id,
        projectId: projects[0].id,
        memberId: withDefault.members[0]?.id,
      };
    }

    this.audit.record({
      who: workspace.members[0]?.id ?? 'system',
      what: `Bootstrapped organization ${organization.name} with ${projects.length} projects`,
      where: { organizationId: organization.id, workspaceId: workspace.id },
      source: 'workspace',
    });

    return {
      organization,
      workspace: this.registry.getWorkspace(workspace.id)!,
      projects,
    };
  }

  switchProject(projectId: string, memberId?: string): ResolvedSwitch {
    const project = this.registry.getProject(projectId);
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const workspace = this.registry.getWorkspace(project.workspaceId);
    if (!workspace) throw new Error('Orphan project workspace missing');
    this.active = {
      workspaceId: workspace.id,
      projectId: project.id,
      memberId: memberId ?? this.active.memberId ?? workspace.members[0]?.id,
    };
    this.audit.record({
      who: this.active.memberId ?? 'local',
      what: `Switched to project ${project.name}`,
      where: { workspaceId: workspace.id, projectId: project.id },
    });
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      projectId: project.id,
      projectName: project.name,
      isolation: this.isolation.describe(project),
    };
  }

  accessCheck(input: {
    resource: AccessResource;
    memberId?: string;
    workspaceId?: string;
  }): {
    allowed: boolean;
    role: WorkspaceRole;
    resource: AccessResource;
    reason: string;
  } {
    const ctx = this.resolver.resolve({
      workspaceId: input.workspaceId,
      memberId: input.memberId,
    });
    const engine = this.policies.get(ctx.workspaceId);
    if (!engine) {
      return {
        allowed: false,
        role: ctx.role,
        resource: input.resource,
        reason: 'No access policy for workspace',
      };
    }
    const result = engine.check(ctx.role, input.resource);
    this.audit.record({
      who: ctx.memberId,
      what: `access_check ${input.resource} → ${result.allowed ? 'allow' : 'deny'}`,
      where: { workspaceId: ctx.workspaceId, projectId: ctx.projectId },
    });
    return {
      allowed: result.allowed,
      role: ctx.role,
      resource: input.resource,
      reason: result.reason,
    };
  }

  workspaceInfo() {
    const ctx = this.resolver.resolve();
    const workspace = this.registry.getWorkspace(ctx.workspaceId)!;
    const projects = this.registry.listProjects(workspace.id);
    const profile = this.deployment.resolve(workspace.settings.deploymentMode);
    return {
      organization: this.organization
        ? { id: this.organization.id, name: this.organization.name }
        : null,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        members: workspace.members,
        settings: workspace.settings,
        createdAt: workspace.createdAt,
      },
      active: ctx,
      projects: projects.map((p) => this.isolation.describe(p)),
      deployment: profile,
      note: 'Architecture foundation only — no SaaS billing or public accounts.',
    };
  }

  async storageStatus() {
    return this.storage.status();
  }

  resolveMcpContext(hints?: {
    workspaceId?: string;
    projectId?: string;
    memberId?: string;
    projectNameHint?: string;
  }) {
    return this.resolver.resolve(hints);
  }

  listAudit(limit = 50): UnifiedAuditEntry[] {
    return this.audit.list(limit);
  }

  setMemberRole(workspaceId: string, memberId: string, role: WorkspaceRole): void {
    this.registry.setMemberRole(workspaceId, memberId, role);
    this.audit.record({
      who: this.active.memberId ?? 'admin',
      what: `Role ${memberId} → ${role}`,
      where: { workspaceId },
    });
  }

  ensureBootstrapped(cwdName = 'Local Project'): void {
    if (this.registry.listWorkspaces().length) return;
    this.bootstrapCompany({
      companyName: 'Local',
      workspaceName: 'Default Workspace',
      projects: [{ name: cwdName }],
      deploymentMode: 'LOCAL',
    });
  }

  getPolicy(workspaceId: string): AccessPolicy | undefined {
    return this.policies.get(workspaceId)?.getPolicy();
  }
}

export function createWorkspaceCore(): WorkspaceCore {
  return new WorkspaceCore();
}

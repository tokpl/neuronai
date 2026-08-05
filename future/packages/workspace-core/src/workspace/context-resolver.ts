import type {
  AccessResource,
  Workspace,
  WorkspaceProject,
  WorkspaceRole,
} from '../types.js';
import type { AccessPolicyEngine } from '../roles/access-policy.js';

export interface McpWorkspaceRequestHints {
  workspaceId?: string;
  projectId?: string;
  memberId?: string;
  /** Fallback: cwd-derived project name */
  projectNameHint?: string;
}

export interface ResolvedWorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  memberId: string;
  role: WorkspaceRole;
  permissions: {
    memory: boolean;
    documents: boolean;
    decisions: boolean;
    security_reports: boolean;
  };
  isolation: WorkspaceProject['isolation'];
}

/**
 * MCP request must know: which project, which workspace, which permissions.
 */
export class WorkspaceContextResolver {
  constructor(
    private readonly getWorkspace: (id: string) => Workspace | undefined,
    private readonly getProject: (id: string) => WorkspaceProject | undefined,
    private readonly listProjects: (workspaceId?: string) => WorkspaceProject[],
    private readonly listWorkspaces: () => Workspace[],
    private readonly getPolicy: (workspaceId: string) => AccessPolicyEngine | undefined,
    private readonly active: () => {
      workspaceId?: string;
      projectId?: string;
      memberId?: string;
    },
  ) {}

  resolve(hints: McpWorkspaceRequestHints = {}): ResolvedWorkspaceContext {
    const active = this.active();
    const workspaces = this.listWorkspaces();
    if (!workspaces.length) {
      throw new Error('No workspace configured — bootstrap with WorkspaceCore first');
    }

    const workspaceId =
      hints.workspaceId ?? active.workspaceId ?? workspaces[0]!.id;
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Unknown workspace: ${workspaceId}`);
    }

    const projects = this.listProjects(workspaceId);
    let project: WorkspaceProject | undefined;

    if (hints.projectId) {
      project = this.getProject(hints.projectId);
    } else if (hints.projectNameHint) {
      project = projects.find(
        (p) => p.name.toLowerCase() === hints.projectNameHint!.toLowerCase(),
      );
    } else if (active.projectId) {
      project = this.getProject(active.projectId);
    } else if (workspace.settings.defaultProjectId) {
      project = this.getProject(workspace.settings.defaultProjectId);
    }

    project = project ?? projects[0];
    if (!project) {
      throw new Error(`Workspace ${workspace.name} has no projects`);
    }

    const memberId = hints.memberId ?? active.memberId ?? workspace.members[0]?.id ?? 'local';
    const role =
      workspace.members.find((m) => m.id === memberId)?.role ??
      workspace.members[0]?.role ??
      'VIEWER';

    const engine = this.getPolicy(workspaceId);
    const perm = (resource: AccessResource) =>
      engine ? engine.check(role, resource).allowed : role !== 'VIEWER';

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      projectId: project.id,
      projectName: project.name,
      memberId,
      role,
      permissions: {
        memory: perm('memory'),
        documents: perm('documents'),
        decisions: perm('decisions'),
        security_reports: perm('security_reports'),
      },
      isolation: project.isolation,
    };
  }
}

export function createWorkspaceContextResolver(
  deps: ConstructorParameters<typeof WorkspaceContextResolver>,
): WorkspaceContextResolver {
  return new WorkspaceContextResolver(...deps);
}

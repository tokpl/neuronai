import type { Workspace, WorkspaceMember, WorkspaceProject, WorkspaceRole } from '../types.js';

export class WorkspaceRegistry {
  private workspaces = new Map<string, Workspace>();
  private projects = new Map<string, WorkspaceProject>();

  upsertWorkspace(ws: Workspace): void {
    this.workspaces.set(ws.id, ws);
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()];
  }

  upsertProject(project: WorkspaceProject): void {
    this.projects.set(project.id, project);
    const ws = this.workspaces.get(project.workspaceId);
    if (ws && !ws.projects.includes(project.id)) {
      ws.projects = [...ws.projects, project.id];
      this.workspaces.set(ws.id, ws);
    }
  }

  getProject(id: string): WorkspaceProject | undefined {
    return this.projects.get(id);
  }

  listProjects(workspaceId?: string): WorkspaceProject[] {
    const all = [...this.projects.values()];
    return workspaceId ? all.filter((p) => p.workspaceId === workspaceId) : all;
  }

  addMember(workspaceId: string, member: WorkspaceMember): Workspace | undefined {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return undefined;
    const next = {
      ...ws,
      members: [...ws.members.filter((m) => m.id !== member.id), member],
    };
    this.workspaces.set(workspaceId, next);
    return next;
  }

  setMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ): Workspace | undefined {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return undefined;
    const next = {
      ...ws,
      members: ws.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
    };
    this.workspaces.set(workspaceId, next);
    return next;
  }

  memberRole(workspaceId: string, memberId: string): WorkspaceRole | undefined {
    return this.workspaces.get(workspaceId)?.members.find((m) => m.id === memberId)?.role;
  }

  loadState(workspaces: Workspace[], projects: WorkspaceProject[]): void {
    this.workspaces.clear();
    this.projects.clear();
    for (const w of workspaces) this.workspaces.set(w.id, w);
    for (const p of projects) this.projects.set(p.id, p);
  }

  snapshot(): { workspaces: Workspace[]; projects: WorkspaceProject[] } {
    return {
      workspaces: this.listWorkspaces(),
      projects: this.listProjects(),
    };
  }
}

export function createWorkspaceRegistry(): WorkspaceRegistry {
  return new WorkspaceRegistry();
}

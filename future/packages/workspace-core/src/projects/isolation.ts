import type { WorkspaceProject } from '../types.js';

/**
 * Each project owns isolated memory / graph / config / security scopes.
 */
export class ProjectIsolationManager {
  describe(project: WorkspaceProject): {
    projectId: string;
    name: string;
    memorySpace: string;
    knowledgeGraph: string;
    configuration: string;
    securityPolicies: string;
  } {
    return {
      projectId: project.id,
      name: project.name,
      memorySpace: project.isolation.memorySpaceId,
      knowledgeGraph: project.isolation.knowledgeGraphId,
      configuration: project.isolation.configScope,
      securityPolicies: project.isolation.securityPolicyId,
    };
  }

  assertIsolated(a: WorkspaceProject, b: WorkspaceProject): boolean {
    return (
      a.isolation.memorySpaceId !== b.isolation.memorySpaceId &&
      a.isolation.knowledgeGraphId !== b.isolation.knowledgeGraphId
    );
  }
}

export function createProjectIsolationManager(): ProjectIsolationManager {
  return new ProjectIsolationManager();
}

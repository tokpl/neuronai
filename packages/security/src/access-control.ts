/**
 * Access control architecture (local + future cloud).
 * Full SaaS auth is NOT implemented — this is the extension surface.
 */

export type NeuronRole = 'LOCAL_USER' | 'TEAM_MEMBER' | 'ADMIN' | 'SERVICE_ACCOUNT';

export type NeuronPermission =
  | 'memory:read'
  | 'memory:write'
  | 'memory:delete'
  | 'memory:export'
  | 'project:purge'
  | 'admin:manage'
  | 'service:ingest';

const ROLE_PERMISSIONS: Record<NeuronRole, ReadonlySet<NeuronPermission>> = {
  LOCAL_USER: new Set([
    'memory:read',
    'memory:write',
    'memory:delete',
    'memory:export',
    'project:purge',
  ]),
  TEAM_MEMBER: new Set(['memory:read', 'memory:write', 'memory:export']),
  ADMIN: new Set([
    'memory:read',
    'memory:write',
    'memory:delete',
    'memory:export',
    'project:purge',
    'admin:manage',
  ]),
  SERVICE_ACCOUNT: new Set(['memory:read', 'memory:write', 'service:ingest']),
};

export interface AccessPrincipal {
  id: string;
  role: NeuronRole;
  projectIds?: string[];
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

export class AccessControlLayer {
  constructor(private readonly principal: AccessPrincipal) {}

  can(permission: NeuronPermission, projectId?: string): AccessDecision {
    const perms = ROLE_PERMISSIONS[this.principal.role];
    if (!perms.has(permission)) {
      return { allowed: false, reason: `role ${this.principal.role} lacks ${permission}` };
    }
    if (
      projectId &&
      this.principal.projectIds &&
      this.principal.projectIds.length > 0 &&
      !this.principal.projectIds.includes(projectId)
    ) {
      return { allowed: false, reason: `principal not scoped to project ${projectId}` };
    }
    return { allowed: true, reason: 'ok' };
  }

  assert(permission: NeuronPermission, projectId?: string): void {
    const decision = this.can(permission, projectId);
    if (!decision.allowed) {
      throw new Error(`Access denied: ${decision.reason}`);
    }
  }
}

/** Default local principal — full control of the workstation project. */
export function createLocalUserPrincipal(id = 'local'): AccessPrincipal {
  return { id, role: 'LOCAL_USER' };
}

export function createAccessControl(principal?: AccessPrincipal): AccessControlLayer {
  return new AccessControlLayer(principal ?? createLocalUserPrincipal());
}

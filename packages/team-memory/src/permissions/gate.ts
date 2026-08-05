import type { MemoryPermission, MemoryScope, PermissionAction, TeamRole } from '../types.js';

/**
 * Default permission matrix for Memory Scope.
 * ORGANIZATION is reserved — same as TEAM until cloud org lands.
 */
export const DEFAULT_PERMISSIONS: MemoryPermission[] = [
  { scope: 'PERSONAL', action: 'read', roles: ['owner', 'reviewer', 'contributor', 'viewer'], ownerOnly: true },
  { scope: 'PERSONAL', action: 'write', roles: ['owner', 'reviewer', 'contributor'], ownerOnly: true },
  { scope: 'PERSONAL', action: 'approve', roles: ['owner'], ownerOnly: true },
  { scope: 'PERSONAL', action: 'archive', roles: ['owner'], ownerOnly: true },

  { scope: 'PROJECT', action: 'read', roles: ['owner', 'reviewer', 'contributor', 'viewer'] },
  { scope: 'PROJECT', action: 'write', roles: ['owner', 'reviewer', 'contributor'] },
  { scope: 'PROJECT', action: 'approve', roles: ['owner', 'reviewer'] },
  { scope: 'PROJECT', action: 'archive', roles: ['owner', 'reviewer'] },

  { scope: 'TEAM', action: 'read', roles: ['owner', 'reviewer', 'contributor', 'viewer'] },
  { scope: 'TEAM', action: 'write', roles: ['owner', 'reviewer', 'contributor'] },
  { scope: 'TEAM', action: 'approve', roles: ['owner', 'reviewer'] },
  { scope: 'TEAM', action: 'archive', roles: ['owner'] },

  { scope: 'ORGANIZATION', action: 'read', roles: ['owner', 'reviewer', 'contributor', 'viewer'] },
  { scope: 'ORGANIZATION', action: 'write', roles: ['owner', 'reviewer'] },
  { scope: 'ORGANIZATION', action: 'approve', roles: ['owner'] },
  { scope: 'ORGANIZATION', action: 'archive', roles: ['owner'] },
];

export class PermissionGate {
  constructor(private readonly matrix: MemoryPermission[] = DEFAULT_PERMISSIONS) {}

  can(input: {
    scope: MemoryScope;
    action: PermissionAction;
    role: TeamRole;
    actorId: string;
    ownerId?: string;
  }): boolean {
    const rule = this.matrix.find((p) => p.scope === input.scope && p.action === input.action);
    if (!rule) return false;
    if (!rule.roles.includes(input.role)) return false;
    if (rule.ownerOnly && input.ownerId && input.ownerId !== input.actorId) return false;
    return true;
  }

  assert(input: {
    scope: MemoryScope;
    action: PermissionAction;
    role: TeamRole;
    actorId: string;
    ownerId?: string;
  }): void {
    if (!this.can(input)) {
      throw new Error(
        `Permission denied: ${input.role} cannot ${input.action} on ${input.scope} scope`,
      );
    }
  }

  describe(scope: MemoryScope): MemoryPermission[] {
    return this.matrix.filter((p) => p.scope === scope);
  }
}

export function createPermissionGate(matrix?: MemoryPermission[]): PermissionGate {
  return new PermissionGate(matrix);
}

export function isSharedScope(scope: MemoryScope): boolean {
  return scope === 'PROJECT' || scope === 'TEAM' || scope === 'ORGANIZATION';
}

export function scopeRank(scope: MemoryScope): number {
  switch (scope) {
    case 'PERSONAL':
      return 1;
    case 'PROJECT':
      return 2;
    case 'TEAM':
      return 3;
    case 'ORGANIZATION':
      return 4;
    default:
      return 0;
  }
}

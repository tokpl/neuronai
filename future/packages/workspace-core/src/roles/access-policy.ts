import type { AccessPolicy, AccessPolicyRule, AccessResource, WorkspaceRole } from '../types.js';
import { newId } from '../types.js';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

/** Default matrix: OWNER/ADMIN full; MEMBER r/w knowledge; VIEWER read-only. */
export function defaultAccessRules(workspaceId: string): AccessPolicy {
  const rules: AccessPolicyRule[] = [];
  const resources: AccessResource[] = [
    'memory',
    'documents',
    'decisions',
    'security_reports',
    'workspace_settings',
    'members',
  ];

  for (const resource of resources) {
    rules.push({
      id: newId('rule'),
      role: 'OWNER',
      resource,
      effect: 'allow',
    });
    rules.push({
      id: newId('rule'),
      role: 'ADMIN',
      resource,
      effect: resource === 'members' ? 'allow' : 'allow',
    });
    if (resource === 'workspace_settings' || resource === 'members') {
      rules.push({ id: newId('rule'), role: 'MEMBER', resource, effect: 'deny' });
      rules.push({ id: newId('rule'), role: 'VIEWER', resource, effect: 'deny' });
    } else if (resource === 'security_reports') {
      rules.push({ id: newId('rule'), role: 'MEMBER', resource, effect: 'allow' });
      rules.push({ id: newId('rule'), role: 'VIEWER', resource, effect: 'allow' });
    } else {
      rules.push({ id: newId('rule'), role: 'MEMBER', resource, effect: 'allow' });
      rules.push({
        id: newId('rule'),
        role: 'VIEWER',
        resource,
        effect: resource === 'decisions' || resource === 'memory' || resource === 'documents' ? 'allow' : 'deny',
      });
    }
  }

  return { id: newId('pol'), workspaceId, rules };
}

export class AccessPolicyEngine {
  constructor(private policy: AccessPolicy) {}

  getPolicy(): AccessPolicy {
    return this.policy;
  }

  setPolicy(policy: AccessPolicy): void {
    this.policy = policy;
  }

  roleAtLeast(actual: WorkspaceRole, required: WorkspaceRole): boolean {
    return ROLE_RANK[actual] >= ROLE_RANK[required];
  }

  check(role: WorkspaceRole, resource: AccessResource): {
    allowed: boolean;
    effect: 'allow' | 'deny';
    reason: string;
  } {
    const matches = this.policy.rules.filter((r) => r.role === role && r.resource === resource);
    const deny = matches.find((r) => r.effect === 'deny');
    if (deny) {
      return { allowed: false, effect: 'deny', reason: `${role} denied for ${resource}` };
    }
    const allow = matches.find((r) => r.effect === 'allow');
    if (allow) {
      return { allowed: true, effect: 'allow', reason: `${role} allowed for ${resource}` };
    }
    // Fallback: OWNER always, others deny
    if (role === 'OWNER') {
      return { allowed: true, effect: 'allow', reason: 'OWNER implicit allow' };
    }
    return { allowed: false, effect: 'deny', reason: `No rule for ${role}/${resource}` };
  }
}

export function createAccessPolicyEngine(policy: AccessPolicy): AccessPolicyEngine {
  return new AccessPolicyEngine(policy);
}

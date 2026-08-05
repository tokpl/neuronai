import type { TeamRole } from '@neuron-ai-memory/team-memory';

import type { KnowledgePermissionLevel } from '../types.js';
import { PERMISSION_RANK } from '../types.js';

/**
 * KnowledgePermissions — VIEW → ADMIN.
 * No enterprise IAM yet; maps onto team-memory roles locally.
 */
export class KnowledgePermissions {
  levelFromRole(role: TeamRole): KnowledgePermissionLevel {
    switch (role) {
      case 'owner':
        return 'ADMIN';
      case 'reviewer':
        return 'APPROVE';
      case 'contributor':
        return 'SUGGEST';
      case 'viewer':
      default:
        return 'VIEW';
    }
  }

  roleFromLevel(level: KnowledgePermissionLevel): TeamRole {
    switch (level) {
      case 'ADMIN':
        return 'owner';
      case 'APPROVE':
        return 'reviewer';
      case 'SUGGEST':
      case 'COMMENT':
        return 'contributor';
      case 'VIEW':
      default:
        return 'viewer';
    }
  }

  can(actor: KnowledgePermissionLevel, required: KnowledgePermissionLevel): boolean {
    return PERMISSION_RANK[actor] >= PERMISSION_RANK[required];
  }

  assert(actor: KnowledgePermissionLevel, required: KnowledgePermissionLevel): void {
    if (!this.can(actor, required)) {
      throw new Error(`Permission denied: ${actor} cannot perform action requiring ${required}`);
    }
  }

  describe(): Record<KnowledgePermissionLevel, string> {
    return {
      VIEW: 'Read shared team knowledge',
      COMMENT: 'Annotate / feedback (reserved)',
      SUGGEST: 'Propose shared memories (DRAFT/REVIEW)',
      APPROVE: 'Approve shared memories for team use',
      ADMIN: 'Manage members, archive, sync config',
    };
  }
}

export function createKnowledgePermissions(): KnowledgePermissions {
  return new KnowledgePermissions();
}

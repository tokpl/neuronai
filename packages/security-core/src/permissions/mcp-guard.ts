import {
  createToolPermissionPolicy,
  type ToolPermissionPolicy,
} from '../policies/tool-permission-policy.js';
import type { McpGuardDecision } from '../types.js';

export interface McpGuardRequest {
  tool: string;
  args?: Record<string, unknown>;
  /** When false, skip authorization even if validated */
  callerTrusted?: boolean;
}

/**
 * MCP call pipeline: validate → authorize → execute (decision only).
 */
export class MCPGuard {
  constructor(private readonly policy: ToolPermissionPolicy = createToolPermissionPolicy()) {}

  getPolicy(): ToolPermissionPolicy {
    return this.policy;
  }

  validate(req: McpGuardRequest): { ok: boolean; reason: string } {
    if (!req.tool || typeof req.tool !== 'string') {
      return { ok: false, reason: 'Missing tool name' };
    }
    if (!/^neuron_[a-z0-9_]+$/i.test(req.tool) && !/^[a-z][a-z0-9_]*$/i.test(req.tool)) {
      return { ok: false, reason: 'Invalid tool name format' };
    }
    if (req.args && typeof req.args !== 'object') {
      return { ok: false, reason: 'Args must be an object' };
    }
    return { ok: true, reason: 'validated' };
  }

  authorize(req: McpGuardRequest): { ok: boolean; effect: McpGuardDecision['effect']; reason: string } {
    const perm = this.policy.resolve(req.tool);
    if (perm.effect === 'blocked') {
      return { ok: false, effect: 'blocked', reason: `Tool ${req.tool} is blocked by policy` };
    }
    if (perm.effect === 'requires_approval' && req.callerTrusted !== true) {
      return {
        ok: false,
        effect: 'requires_approval',
        reason: `Tool ${req.tool} requires approval`,
      };
    }
    return { ok: true, effect: perm.effect, reason: 'authorized' };
  }

  /**
   * Full guard: validate → authorize → execute flag (does not invoke the tool).
   */
  gate(req: McpGuardRequest): McpGuardDecision {
    const v = this.validate(req);
    if (!v.ok) {
      return {
        tool: req.tool,
        validated: false,
        authorized: false,
        execute: false,
        effect: 'blocked',
        reason: v.reason,
      };
    }
    const a = this.authorize(req);
    return {
      tool: req.tool,
      validated: true,
      authorized: a.ok,
      execute: a.ok,
      effect: a.effect,
      reason: a.reason,
    };
  }
}

export function createMCPGuard(policy?: ToolPermissionPolicy): MCPGuard {
  return new MCPGuard(policy);
}

import type { ToolPermissionEffect } from '../types.js';

export interface SandboxRequest {
  action: string;
  /** e.g. script path or command summary (never execute blindly) */
  target?: string;
  trusted?: boolean;
}

export interface SandboxDecision {
  allowed: boolean;
  isolated: boolean;
  effect: ToolPermissionEffect;
  reason: string;
}

/**
 * Risky ops get isolated / limited permissions.
 * Does NOT execute unknown scripts or automatic commands.
 */
export class SandboxManager {
  evaluate(req: SandboxRequest): SandboxDecision {
    const action = req.action.toLowerCase();

    if (/script|shell|exec|eval|spawn|command/.test(action) && !req.trusted) {
      return {
        allowed: false,
        isolated: true,
        effect: 'blocked',
        reason: 'Unknown scripts and automatic commands are not executed',
      };
    }

    if (/delete|rm\b|unlink|format/.test(action)) {
      return {
        allowed: false,
        isolated: true,
        effect: 'blocked',
        reason: 'Destructive filesystem actions are blocked in sandbox',
      };
    }

    if (/network|fetch|http|upload/.test(action)) {
      return {
        allowed: false,
        isolated: true,
        effect: 'requires_approval',
        reason: 'Network requests require explicit approval',
      };
    }

    if (/read|scan|analyze|sanitize/.test(action)) {
      return {
        allowed: true,
        isolated: true,
        effect: 'allowed',
        reason: 'Read-only analysis allowed under limited permissions',
      };
    }

    return {
      allowed: false,
      isolated: true,
      effect: 'requires_approval',
      reason: 'Unclassified risky action requires approval',
    };
  }
}

export function createSandboxManager(): SandboxManager {
  return new SandboxManager();
}

/** Neuron self-protection types — not an antivirus / EDR product. */

export type TrustLevel = 'UNKNOWN' | 'LIMITED' | 'TRUSTED' | 'VERIFIED';

export type PrivacyMode = 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ALLOWED';

export type DataClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'secret';

export type ToolPermissionEffect = 'allowed' | 'blocked' | 'requires_approval';

export type SecurityEventType =
  | 'secret.detected'
  | 'sanitization.applied'
  | 'injection.detected'
  | 'permission.denied'
  | 'permission.changed'
  | 'sandbox.blocked'
  | 'memory.rejected'
  | 'mcp.validated'
  | 'mcp.authorized'
  | 'mcp.blocked'
  | 'trust.assessed'
  | 'policy.evaluated';

export interface SecurityPermission {
  id: string;
  effect: ToolPermissionEffect;
  description?: string;
}

export interface SecurityPolicyRule {
  id: string;
  description: string;
  enabled: boolean;
}

export interface SecurityContext {
  project: string;
  trustLevel: TrustLevel;
  permissions: SecurityPermission[];
  dataClassification: DataClassification;
  policies: SecurityPolicyRule[];
  privacyMode: PrivacyMode;
}

export interface SecretFinding {
  id: string;
  kind: 'api_key' | 'token' | 'password' | 'private_key' | 'credential' | 'other';
  location: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SanitizationResult {
  originalLength: number;
  sanitized: string;
  redactionCount: number;
  findings: SecretFinding[];
}

export interface InjectionFinding {
  id: string;
  pattern: string;
  excerpt: string;
  sourceHint: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SourceTrustReport {
  path: string;
  trustLevel: TrustLevel;
  reasons: string[];
  score: number;
}

export interface MemorySecurityDecision {
  accepted: boolean;
  reason: string;
  trustLevel: TrustLevel;
  title: string;
}

export interface McpGuardDecision {
  tool: string;
  validated: boolean;
  authorized: boolean;
  execute: boolean;
  effect: ToolPermissionEffect;
  reason: string;
}

export interface SecurityAuditEntry {
  id: string;
  type: SecurityEventType;
  at: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface SecurityCoreStoreDocument {
  version: 1;
  context: SecurityContext;
  audit: SecurityAuditEntry[];
  blockedActions: string[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultSecurityContext(project = 'local'): SecurityContext {
  return {
    project,
    trustLevel: 'LIMITED',
    permissions: [
      { id: 'read_files', effect: 'allowed', description: 'Read project files' },
      { id: 'delete_files', effect: 'blocked', description: 'Delete files' },
      {
        id: 'network_request',
        effect: 'requires_approval',
        description: 'Outbound network',
      },
      {
        id: 'run_script',
        effect: 'blocked',
        description: 'Execute unknown scripts',
      },
      {
        id: 'write_memory',
        effect: 'requires_approval',
        description: 'Persist new knowledge',
      },
    ],
    dataClassification: 'internal',
    policies: [
      { id: 'sanitize_before_ai', description: 'Sanitize context before AI', enabled: true },
      { id: 'block_injection', description: 'Detect prompt injection', enabled: true },
      { id: 'reject_poison_memory', description: 'Reject untrusted malicious memory', enabled: true },
      { id: 'mcp_guard', description: 'Validate/authorize MCP tools', enabled: true },
    ],
    privacyMode: 'LOCAL_ONLY',
  };
}

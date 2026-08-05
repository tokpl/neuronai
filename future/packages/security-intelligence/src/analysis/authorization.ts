import type { AuthEndpointRisk, SecuritySeverity } from '../types.js';

export interface EndpointHint {
  method: string;
  path: string;
  /** surrounding code / route registration text */
  context?: string;
}

/**
 * Authorization gap advisor for HTTP-style endpoints.
 */
export class AuthorizationAnalyzer {
  analyzeEndpoint(endpoint: EndpointHint): AuthEndpointRisk {
    const ctx = `${endpoint.method} ${endpoint.path}\n${endpoint.context ?? ''}`.toLowerCase();
    const hasAuthentication = /auth|jwt|session|bearer|passport|clerk|requireuser/.test(ctx);
    const hasAuthorization =
      /authorize|permission|policy|casl|rbac|can\(|guard|acl/.test(ctx);
    const hasRoleCheck = /role|admin|owner|isadmin|requireadmin|scopes?/.test(ctx);
    const hasAudit = /audit|activity.?log|security.?log|trail/.test(ctx);

    const notes: string[] = [];
    if (!hasAuthentication) notes.push('No clear authentication signal');
    if (!hasAuthorization) notes.push('No clear authorization / permission check');
    if (isDestructive(endpoint.method) && !hasRoleCheck) {
      notes.push('Destructive method without explicit role check');
    }
    if (isAdminPath(endpoint.path) && !hasAudit) {
      notes.push('Admin-like path without audit logging signal');
    }
    if (isAdminPath(endpoint.path) && !hasAuthorization && !hasRoleCheck) {
      notes.push('Admin endpoint may be missing role gate');
    }

    const risk = scoreRisk({
      method: endpoint.method,
      path: endpoint.path,
      hasAuthentication,
      hasAuthorization,
      hasRoleCheck,
      hasAudit,
    });

    return {
      endpoint: endpoint.path,
      method: endpoint.method.toUpperCase(),
      hasAuthentication,
      hasAuthorization,
      hasRoleCheck,
      hasAudit,
      risk,
      notes: notes.length ? notes : ['Authz signals look present — still verify manually'],
    };
  }

  analyzeMany(endpoints: EndpointHint[]): AuthEndpointRisk[] {
    return endpoints.map((e) => this.analyzeEndpoint(e));
  }
}

function isDestructive(method: string): boolean {
  return /^(DELETE|PUT|PATCH)$/i.test(method);
}

function isAdminPath(path: string): boolean {
  return /admin|internal|manage/i.test(path);
}

function scoreRisk(input: {
  method: string;
  path: string;
  hasAuthentication: boolean;
  hasAuthorization: boolean;
  hasRoleCheck: boolean;
  hasAudit: boolean;
}): SecuritySeverity {
  let score = 0;
  if (!input.hasAuthentication) score += 3;
  if (!input.hasAuthorization) score += 2;
  if (isDestructive(input.method) && !input.hasRoleCheck) score += 2;
  if (isAdminPath(input.path) && !input.hasRoleCheck) score += 2;
  if (isAdminPath(input.path) && !input.hasAudit) score += 1;
  if (score >= 6) return 'CRITICAL';
  if (score >= 4) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

export function createAuthorizationAnalyzer(): AuthorizationAnalyzer {
  return new AuthorizationAnalyzer();
}

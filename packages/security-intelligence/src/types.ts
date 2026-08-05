export type SecurityMemoryType =
  | 'SECRET'
  | 'AUTHORIZATION'
  | 'DATA_ACCESS'
  | 'CRYPTO'
  | 'DEPENDENCY'
  | 'CONFIGURATION';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';

export type SecurityReviewMode = 'QUICK' | 'DEEP' | 'CHANGE';

export interface SecurityMemory {
  id: string;
  type: SecurityMemoryType;
  description: string;
  severity: SecuritySeverity;
  confidence: number;
  affectedModules: string[];
  resolution: string | null;
  status: SecurityStatus;
  /** Never contains secret values — path / rule / pattern only */
  location?: string;
  recommendation?: string;
  relatedIncidentIds?: string[];
  relatedDecisionIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SecretFinding {
  id: string;
  /** e.g. API_KEY, JWT, PASSWORD, PRIVATE_KEY — never the value */
  secretType: string;
  location: string;
  recommendation: string;
  confidence: number;
  /** Redacted snippet marker only */
  evidence: string;
}

export interface AuthEndpointRisk {
  endpoint: string;
  method: string;
  hasAuthentication: boolean;
  hasAuthorization: boolean;
  hasRoleCheck: boolean;
  hasAudit: boolean;
  risk: SecuritySeverity;
  notes: string[];
}

export interface SecurityPatternModel {
  authMiddleware: string[];
  permissionChecks: string[];
  inputValidation: string[];
  encryptionUsage: string[];
  dataAccessPatterns: string[];
  summary: string;
}

export interface ThreatAsset {
  name: string;
  description: string;
}

export interface ThreatEntryPoint {
  name: string;
  description: string;
}

export interface TrustBoundary {
  name: string;
  description: string;
}

export interface ThreatRisk {
  asset: string;
  entryPoint: string;
  risk: string;
  severity: SecuritySeverity;
}

export interface ThreatModel {
  assets: ThreatAsset[];
  entryPoints: ThreatEntryPoint[];
  trustBoundaries: TrustBoundary[];
  risks: ThreatRisk[];
  generatedAt: string;
}

export interface DependencySecurityNote {
  packageName: string;
  version?: string;
  usageContext: string;
  handlesAuth: boolean;
  handlesSecrets: boolean;
  handlesPayments: boolean;
  notes: string[];
}

export interface ChangeSecurityImpact {
  impact: SecuritySeverity;
  reasons: string[];
  affectedModules: string[];
  ruleHits: string[];
  relatedIncidents: string[];
  findings: SecurityMemory[];
}

export interface SecurityReviewResult {
  mode: SecurityReviewMode;
  memories: SecurityMemory[];
  secrets: SecretFinding[];
  authRisks: AuthEndpointRisk[];
  patterns: SecurityPatternModel;
  threatModel?: ThreatModel;
  changeImpact?: ChangeSecurityImpact;
  note: string;
}

export interface SecurityStoreDocument {
  version: 1;
  memories: SecurityMemory[];
  secrets: SecretFinding[];
  updatedAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

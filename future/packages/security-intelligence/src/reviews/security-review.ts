import { createAuthorizationAnalyzer, type EndpointHint } from '../analysis/authorization.js';
import { createChangeSecurityAnalyzer } from '../analysis/change-security.js';
import { createSecurityPatternAnalyzer } from '../analysis/patterns.js';
import { createSecretDetector } from '../secrets/detector.js';
import { createThreatModelGenerator } from '../threats/threat-model.js';
import type {
  SecurityMemory,
  SecurityReviewMode as ReviewMode,
  SecurityReviewResult,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Security review engine — advisor only; never mutates or deploys code.
 */
export class SecurityReviewer {
  private readonly secrets = createSecretDetector();
  private readonly patterns = createSecurityPatternAnalyzer();
  private readonly authz = createAuthorizationAnalyzer();
  private readonly change = createChangeSecurityAnalyzer();
  private readonly threats = createThreatModelGenerator();

  review(input: {
    mode: ReviewMode;
    files?: Array<{ path: string; content: string }>;
    endpoints?: EndpointHint[];
    filePaths?: string[];
    architectureNotes?: string[];
    securityRules?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
    diff?: string;
    changedPaths?: string[];
    modules?: string[];
  }): SecurityReviewResult {
    const mode = input.mode;
    const files = input.files ?? [];
    const secrets =
      mode === 'CHANGE' && !files.length
        ? []
        : this.secrets.scanFiles(mode === 'QUICK' ? files.slice(0, 20) : files);

    const patterns = this.patterns.analyze({
      filePaths: input.filePaths ?? files.map((f) => f.path),
      snippets: files.slice(0, mode === 'QUICK' ? 10 : 50).map((f) => f.content.slice(0, 2000)),
      architectureNotes: input.architectureNotes,
    });

    const authRisks = this.authz.analyzeMany(
      input.endpoints ??
        (mode === 'QUICK' ? [] : inferEndpointsFromSnippets(files.map((f) => f.content))),
    );

    const memories: SecurityMemory[] = [
      ...secrets.map((s) => secretToMemory(s)),
      ...authRisks.filter((r) => r.risk !== 'LOW').map((r) => authToMemory(r)),
    ];

    const result: SecurityReviewResult = {
      mode,
      memories,
      secrets,
      authRisks,
      patterns,
      note: 'Neuron is a security advisor — it does not auto-fix, delete code, or access production.',
    };

    if (mode === 'DEEP') {
      result.threatModel = this.threats.generate({
        modules: input.modules,
        architectureNotes: input.architectureNotes,
      });
    }

    if (mode === 'CHANGE' || input.diff || input.changedPaths?.length) {
      result.changeImpact = this.change.analyze({
        diff: input.diff,
        changedPaths: input.changedPaths,
        securityRules: input.securityRules,
        previousIncidents: input.previousIncidents,
        modules: input.modules,
      });
      for (const f of result.changeImpact.findings) {
        if (!memories.some((m) => m.description === f.description)) memories.push(f);
      }
    }

    return result;
  }
}

function inferEndpointsFromSnippets(snippets: string[]): EndpointHint[] {
  const out: EndpointHint[] = [];
  const re =
    /\b(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  for (const s of snippets) {
    let m: RegExpExecArray | null;
    const local = s.slice(0, 8000);
    while ((m = re.exec(local))) {
      out.push({
        method: m[1]!.toUpperCase(),
        path: m[2]!,
        context: local.slice(Math.max(0, m.index - 120), m.index + 200),
      });
      if (out.length >= 25) return out;
    }
  }
  return out;
}

function secretToMemory(s: {
  id: string;
  secretType: string;
  location: string;
  recommendation: string;
  confidence: number;
}): SecurityMemory {
  const now = nowIso();
  return {
    id: newId('sm'),
    type: 'SECRET',
    description: `Detected ${s.secretType} pattern`,
    severity: s.secretType === 'PRIVATE_KEY' || s.secretType.includes('LIVE') ? 'CRITICAL' : 'HIGH',
    confidence: s.confidence,
    affectedModules: ['Configuration'],
    resolution: null,
    status: 'OPEN',
    location: s.location,
    recommendation: s.recommendation,
    createdAt: now,
    updatedAt: now,
  };
}

function authToMemory(r: {
  method: string;
  endpoint: string;
  risk: SecurityMemory['severity'];
  notes: string[];
}): SecurityMemory {
  const now = nowIso();
  return {
    id: newId('sm'),
    type: 'AUTHORIZATION',
    description: `${r.method} ${r.endpoint}: ${r.notes[0] ?? 'authz risk'}`,
    severity: r.risk,
    confidence: 0.7,
    affectedModules: [/admin/i.test(r.endpoint) ? 'Admin' : 'API'],
    resolution: null,
    status: 'OPEN',
    recommendation: 'Add authentication, authorization, role checks, and audit as needed.',
    createdAt: now,
    updatedAt: now,
  };
}

export function createSecurityReviewer(): SecurityReviewer {
  return new SecurityReviewer();
}

export function createSecurityReviewMode(): SecurityReviewer {
  return createSecurityReviewer();
}

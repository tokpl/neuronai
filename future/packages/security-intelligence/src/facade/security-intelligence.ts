import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createAuthorizationAnalyzer, type EndpointHint } from '../analysis/authorization.js';
import { createChangeSecurityAnalyzer } from '../analysis/change-security.js';
import { createDependencySecurityAnalyzer } from '../analysis/dependency.js';
import { createSecurityPatternAnalyzer } from '../analysis/patterns.js';
import { listDefaultSecurityRules } from '../policies/security-rules.js';
import { createSecurityReportGenerator } from '../reports/security-report.js';
import { createSecurityReviewer } from '../reviews/security-review.js';
import { createSecretDetector } from '../secrets/detector.js';
import { createThreatModelGenerator } from '../threats/threat-model.js';
import type {
  SecurityMemory,
  SecurityMemoryType,
  SecurityReviewMode,
  SecuritySeverity,
  SecurityStatus,
  SecurityStoreDocument,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Security Intelligence facade — local advisor; never stores secret values or auto-remediates.
 */
export class SecurityIntelligence {
  private memories: SecurityMemory[] = [];
  private readonly secrets = createSecretDetector();
  private readonly patterns = createSecurityPatternAnalyzer();
  private readonly authz = createAuthorizationAnalyzer();
  private readonly change = createChangeSecurityAnalyzer();
  private readonly deps = createDependencySecurityAnalyzer();
  private readonly threats = createThreatModelGenerator();
  private readonly reviewer = createSecurityReviewer();
  private readonly reports = createSecurityReportGenerator();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'security-memories.json'), 'utf8'),
      ) as SecurityStoreDocument;
      this.memories = raw.memories ?? [];
    } catch {
      this.memories = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'security-memories.json');
    const doc: SecurityStoreDocument = {
      version: 1,
      memories: this.memories,
      secrets: [], // never persist secret values; findings are folded into memories without values
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(doc, null, 2), 'utf8');
    return path;
  }

  async writeReport(neuronDir: string, markdown: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'security-report.md');
    await writeFile(path, markdown, 'utf8');
    return path;
  }

  listMemories(): SecurityMemory[] {
    return [...this.memories];
  }

  remember(input: {
    type: SecurityMemoryType;
    description: string;
    severity?: SecuritySeverity;
    confidence?: number;
    affectedModules?: string[];
    location?: string;
    recommendation?: string;
    relatedIncidentIds?: string[];
    relatedDecisionIds?: string[];
  }): SecurityMemory {
    const now = nowIso();
    const mem: SecurityMemory = {
      id: newId('sm'),
      type: input.type,
      description: input.description,
      severity: input.severity ?? 'MEDIUM',
      confidence: input.confidence ?? 0.7,
      affectedModules: input.affectedModules ?? [],
      resolution: null,
      status: 'OPEN',
      location: input.location,
      recommendation: input.recommendation,
      relatedIncidentIds: input.relatedIncidentIds,
      relatedDecisionIds: input.relatedDecisionIds,
      createdAt: now,
      updatedAt: now,
    };
    this.memories.unshift(mem);
    return mem;
  }

  resolveMemory(id: string, resolution: string, status: SecurityStatus = 'RESOLVED'): SecurityMemory {
    const mem = this.memories.find((m) => m.id === id);
    if (!mem) throw new Error(`Unknown security memory: ${id}`);
    mem.resolution = resolution;
    mem.status = status;
    mem.updatedAt = nowIso();
    return mem;
  }

  securityHistory(query?: string): SecurityMemory[] {
    if (!query?.trim()) return this.listMemories();
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    return this.memories.filter((m) => {
      const hay = `${m.type} ${m.description} ${m.location ?? ''} ${m.affectedModules.join(' ')}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
  }

  securityContext(input: {
    query: string;
    architectureNotes?: string[];
    securityRules?: string[];
    filePaths?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
  }) {
    const patterns = this.patterns.analyze({
      filePaths: input.filePaths,
      architectureNotes: [...(input.architectureNotes ?? []), input.query],
    });
    const rules =
      input.securityRules?.length ? input.securityRules : listDefaultSecurityRules().map((r) => r.rule);
    const related = this.securityHistory(input.query).slice(0, 10);
    const incidentHits = (input.previousIncidents ?? [])
      .filter((i) =>
        overlap(
          `${input.query} ${input.architectureNotes?.join(' ') ?? ''}`.toLowerCase(),
          `${i.title} ${i.description ?? ''}`.toLowerCase(),
        ) >= 1,
      )
      .slice(0, 8);

    const risks: string[] = [];
    if (/admin|dashboard|role|permission/.test(input.query.toLowerCase())) {
      risks.push('Admin / elevated surface — require authz + audit logging');
    }
    if (/auth|login|token|jwt/.test(input.query.toLowerCase())) {
      risks.push('Auth changes can regress session/JWT lifetime and lockouts');
    }
    if (/payment|billing|stripe/.test(input.query.toLowerCase())) {
      risks.push('Payment path — verify webhooks, idempotency, and least privilege');
    }
    if (!patterns.permissionChecks.length) {
      risks.push('Permission-check patterns not evident in provided context');
    }

    return {
      query: input.query,
      relevantSecurityRules: rules,
      existingPatterns: patterns,
      potentialRisks: risks,
      relatedSecurityMemories: related,
      relatedIncidents: incidentHits,
      defaultRules: listDefaultSecurityRules(),
      note: 'Neuron advises only — no automatic security code changes.',
    };
  }

  review(input: {
    mode?: SecurityReviewMode;
    files?: Array<{ path: string; content: string }>;
    endpoints?: EndpointHint[];
    filePaths?: string[];
    architectureNotes?: string[];
    securityRules?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
    diff?: string;
    changedPaths?: string[];
    modules?: string[];
  }) {
    const result = this.reviewer.review({
      mode: input.mode ?? 'QUICK',
      ...input,
      securityRules:
        input.securityRules ?? listDefaultSecurityRules().map((r) => r.rule),
    });
    for (const m of result.memories) {
      if (!this.memories.some((x) => x.description === m.description && x.location === m.location)) {
        this.memories.unshift(m);
      }
    }
    return result;
  }

  threatModel(input: {
    modules?: string[];
    architectureNotes?: string[];
    entryPoints?: string[];
    assets?: string[];
  }) {
    return this.threats.generate(input);
  }

  checkChangeSecurity(input: {
    diff?: string;
    changedPaths?: string[];
    securityRules?: string[];
    previousIncidents?: Array<{ id: string; title: string; description?: string }>;
    modules?: string[];
  }) {
    return this.change.analyze({
      ...input,
      securityRules: input.securityRules ?? listDefaultSecurityRules().map((r) => r.rule),
    });
  }

  detectSecrets(files: Array<{ path: string; content: string }>) {
    return this.secrets.scanFiles(files);
  }

  analyzeDependencies(deps: Array<{ name: string; version?: string; importers?: string[] }>) {
    return this.deps.analyze(deps);
  }

  analyzeAuthorization(endpoints: EndpointHint[]) {
    return this.authz.analyzeMany(endpoints);
  }

  buildReport(input: {
    overview?: string;
    architectureNotes?: string[];
    mode?: SecurityReviewMode;
    files?: Array<{ path: string; content: string }>;
    previousIncidents?: Array<{ title: string; id?: string }>;
  }) {
    const review = this.review({
      mode: input.mode ?? 'DEEP',
      files: input.files,
      architectureNotes: input.architectureNotes,
      previousIncidents: input.previousIncidents?.map((i) => ({
        id: i.id ?? 'unknown',
        title: i.title,
      })),
    });
    return this.reports.markdown({
      overview: input.overview,
      architectureNotes: input.architectureNotes,
      review,
      threatModel: review.threatModel,
      previousIncidents: input.previousIncidents,
    });
  }

  defaultSecurityRules() {
    return listDefaultSecurityRules();
  }
}

function overlap(a: string, b: string): number {
  const ta = new Set(a.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  let n = 0;
  for (const t of b.split(/[^a-z0-9]+/)) if (ta.has(t)) n += 1;
  return n;
}

export function createSecurityIntelligence(): SecurityIntelligence {
  return new SecurityIntelligence();
}

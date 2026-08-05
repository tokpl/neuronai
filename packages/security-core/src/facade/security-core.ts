import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createSecurityAuditLog, type SecurityAuditLog } from '../audit/security-audit-log.js';
import {
  renderSecurityReport,
  writeSecurityReport,
} from '../audit/security-report.js';
import { createMemorySecurityManager } from '../memory/memory-security-manager.js';
import { createMCPGuard } from '../permissions/mcp-guard.js';
import { createPromptInjectionDetector } from '../policies/prompt-injection.js';
import { PrivacyPolicy } from '../policies/privacy-and-trust.js';
import { createSourceTrustAnalyzer } from '../policies/source-trust.js';
import { createToolPermissionPolicy } from '../policies/tool-permission-policy.js';
import { createSandboxManager } from '../sandbox/sandbox-manager.js';
import { createContextSanitizer } from '../sanitization/context-sanitizer.js';
import {
  createNoopEncryptionProvider,
  type EncryptionProvider,
} from '../secrets/encryption-provider.js';
import { createSecretScanner } from '../secrets/secret-scanner.js';
import type {
  InjectionFinding,
  McpGuardDecision,
  MemorySecurityDecision,
  PrivacyMode,
  SecretFinding,
  SecurityContext,
  SourceTrustReport,
  ToolPermissionEffect,
} from '../types.js';
import { defaultSecurityContext, nowIso } from '../types.js';
import type { MemoryCandidate } from '../memory/memory-security-manager.js';
import type { SourceTrustInput } from '../policies/source-trust.js';
import type { SandboxRequest } from '../sandbox/sandbox-manager.js';

const STORE_FILE = 'security-core.json';

export interface SecurityCheckResult {
  safe: boolean;
  sanitized: string;
  secrets: SecretFinding[];
  injections: InjectionFinding[];
  message: string;
}

export interface SecurityScanResult {
  secrets: SecretFinding[];
  injections: InjectionFinding[];
  trust: SourceTrustReport[];
  blockedActions: string[];
  context: SecurityContext;
  reportMarkdown: string;
}

/**
 * Neuron self-protection facade (local only — no antivirus / EDR).
 */
export class SecurityCore {
  readonly secrets = createSecretScanner();
  readonly sanitizer = createContextSanitizer();
  readonly injection = createPromptInjectionDetector();
  readonly trustAnalyzer = createSourceTrustAnalyzer();
  readonly toolPolicy = createToolPermissionPolicy();
  readonly mcpGuard = createMCPGuard(this.toolPolicy);
  readonly sandbox = createSandboxManager();
  readonly memorySecurity = createMemorySecurityManager();
  readonly audit: SecurityAuditLog = createSecurityAuditLog();
  readonly privacy = new PrivacyPolicy();
  encryption: EncryptionProvider = createNoopEncryptionProvider();

  private context: SecurityContext = defaultSecurityContext();

  constructor() {
    for (const p of this.context.permissions) {
      this.toolPolicy.set(p.id, p.effect, p.description);
    }
  }

  async load(neuronDir: string): Promise<void> {
    await this.audit.load(neuronDir);
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, STORE_FILE), 'utf8'),
      ) as { context?: SecurityContext };
      if (raw.context) {
        this.context = {
          ...defaultSecurityContext(raw.context.project),
          ...raw.context,
        };
        for (const p of this.context.permissions) {
          this.toolPolicy.set(p.id, p.effect, p.description);
        }
      }
    } catch {
      this.context = defaultSecurityContext();
    }
  }

  async save(neuronDir: string): Promise<void> {
    await mkdir(neuronDir, { recursive: true });
    await writeFile(
      join(neuronDir, STORE_FILE),
      `${JSON.stringify({ version: 1, context: this.context, updatedAt: nowIso() }, null, 2)}\n`,
      'utf8',
    );
    await this.audit.save(neuronDir);
  }

  getContext(): SecurityContext {
    return {
      ...this.context,
      permissions: this.toolPolicy.list(),
    };
  }

  setPrivacyMode(mode: PrivacyMode): SecurityContext {
    this.context = { ...this.context, privacyMode: this.privacy.resolve(mode) };
    this.audit.record('policy.evaluated', `PrivacyMode → ${mode}`);
    return this.getContext();
  }

  setPermission(id: string, effect: ToolPermissionEffect): void {
    this.toolPolicy.set(id, effect);
    this.context = { ...this.context, permissions: this.toolPolicy.list() };
    this.audit.record('permission.changed', `${id} → ${effect}`);
  }

  /**
   * Pre-AI security check: scan → sanitize → injection detect.
   */
  checkContext(text: string, sourceHint = 'context'): SecurityCheckResult {
    const sanitized = this.sanitizer.sanitize(text, sourceHint);
    if (sanitized.findings.length) {
      this.audit.record('secret.detected', `${sanitized.findings.length} secret(s) in ${sourceHint}`, {
        count: sanitized.findings.length,
      });
      this.audit.record('sanitization.applied', `Redacted context (${sanitized.redactionCount})`);
    }
    const injections = this.injection.analyze(text, sourceHint);
    for (const inj of injections) {
      this.audit.record('injection.detected', inj.pattern, { sourceHint: inj.sourceHint });
    }
    const safe = sanitized.findings.every((f) => f.severity !== 'critical') &&
      !injections.some((i) => i.severity === 'high');

    const message = sanitized.findings.length
      ? `Contains secrets (${sanitized.findings.map((f) => f.kind).join(', ')}). Sanitized before analysis.`
      : injections.length
        ? `Prompt-injection patterns found (${injections.length}). Review source trust.`
        : 'Context looks clean for local analysis.';

    return {
      safe: safe && !sanitized.findings.length,
      sanitized: sanitized.sanitized,
      secrets: sanitized.findings,
      injections,
      message,
    };
  }

  securityScan(input: {
    texts?: Array<{ path: string; content: string }>;
    sources?: SourceTrustInput[];
  }): SecurityScanResult {
    const files = input.texts ?? [];
    const secrets = this.secrets.scanFiles(files);
    const injections = files.flatMap((f) => this.injection.analyze(f.content, f.path));
    const trust = (input.sources ?? files.map((f) => ({ path: f.path }))).map((s) =>
      this.trustAnalyzer.assess(s),
    );
    for (const s of secrets) {
      this.audit.record('secret.detected', s.evidence, { kind: s.kind, location: s.location });
    }
    const ctx = this.getContext();
    const blockedActions = this.audit.blockedActions();
    const reportMarkdown = renderSecurityReport({
      context: ctx,
      secrets,
      injections,
      trust,
      blockedActions,
      audit: this.audit.list(20),
    });
    return { secrets, injections, trust, blockedActions, context: ctx, reportMarkdown };
  }

  gateMcp(tool: string, args?: Record<string, unknown>, callerTrusted?: boolean): McpGuardDecision {
    const decision = this.mcpGuard.gate({ tool, args, callerTrusted });
    if (decision.validated) {
      this.audit.record('mcp.validated', tool);
    }
    if (decision.authorized) {
      this.audit.record('mcp.authorized', tool);
    } else {
      this.audit.record(
        decision.effect === 'blocked' ? 'mcp.blocked' : 'permission.denied',
        decision.reason,
        { tool },
      );
    }
    return decision;
  }

  evaluateSandbox(req: SandboxRequest) {
    const d = this.sandbox.evaluate(req);
    if (!d.allowed) {
      this.audit.record('sandbox.blocked', d.reason, { action: req.action });
    }
    return d;
  }

  evaluateMemory(candidate: MemoryCandidate): MemorySecurityDecision {
    const d = this.memorySecurity.evaluate(candidate);
    if (!d.accepted) {
      this.audit.record('memory.rejected', d.reason, { title: d.title });
    }
    return d;
  }

  trustReport(sources: SourceTrustInput[]): {
    sources: SourceTrustReport[];
    projectTrust: string;
  } {
    const sourcesOut = sources.map((s) => {
      const r = this.trustAnalyzer.assess(s);
      this.audit.record('trust.assessed', `${r.path} → ${r.trustLevel}`, { score: r.score });
      return r;
    });
    return { sources: sourcesOut, projectTrust: this.context.trustLevel };
  }

  async writeReport(neuronDir: string, scan?: SecurityScanResult): Promise<string> {
    const result =
      scan ??
      this.securityScan({ texts: [], sources: [] });
    return writeSecurityReport(neuronDir, {
      context: result.context,
      secrets: result.secrets,
      injections: result.injections,
      trust: result.trust,
      blockedActions: result.blockedActions,
      audit: this.audit.list(30),
    });
  }
}

export function createSecurityCore(): SecurityCore {
  return new SecurityCore();
}

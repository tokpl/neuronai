import { join } from 'node:path';

import { createSecurityCore } from '@neuron-ai-memory/security-core';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadCore(runtime: NeuronRuntime) {
  const core = createSecurityCore();
  await core.load(neuronDir(runtime));
  return core;
}

/** Full security scan before / during AI-assisted analysis. */
export async function handleSecurityScan(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    texts?: Array<{ path: string; content: string }>;
    sources?: Array<{
      path: string;
      daysSinceChange?: number;
      author?: string;
      locationKind?: 'src' | 'docs' | 'vendor' | 'generated' | 'root' | 'unknown';
      gitUntracked?: boolean;
      fromDependency?: boolean;
    }>;
  },
) {
  try {
    const core = await loadCore(runtime);
    const scan = core.securityScan({
      texts: args.texts ?? [],
      sources: args.sources,
    });
    const reportPath = await core.writeReport(neuronDir(runtime), scan);
    await core.save(neuronDir(runtime));
    return okResult({
      secrets: scan.secrets,
      injections: scan.injections,
      trust: scan.trust,
      blockedActions: scan.blockedActions,
      context: scan.context,
      reportPath,
      reportMarkdown: scan.reportMarkdown,
      note: 'Neuron self-protection scan — no antivirus/EDR, no auto-remediation.',
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Sanitize / check data before sending to AI. */
export async function handleCheckContext(
  runtime: NeuronRuntime,
  args: { projectId?: string; text: string; sourceHint?: string },
) {
  try {
    const core = await loadCore(runtime);
    const result = core.checkContext(args.text, args.sourceHint ?? 'context');
    await core.save(neuronDir(runtime));
    return okResult({
      ...result,
      note: 'Sanitized text is safe to pass to models; secrets never stored in audit.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleTrustReport(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    sources?: Array<{
      path: string;
      daysSinceChange?: number;
      author?: string;
      locationKind?: 'src' | 'docs' | 'vendor' | 'generated' | 'root' | 'unknown';
      gitUntracked?: boolean;
      fromDependency?: boolean;
    }>;
  },
) {
  try {
    const core = await loadCore(runtime);
    const report = core.trustReport(args.sources ?? [{ path: 'README.md', daysSinceChange: 1 }]);
    await core.save(neuronDir(runtime));
    return okResult({
      ...report,
      context: core.getContext(),
      note: 'Source trust only — not a malware scanner.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleAuditLog(
  runtime: NeuronRuntime,
  args: { projectId?: string; limit?: number },
) {
  try {
    const core = await loadCore(runtime);
    return okResult({
      entries: core.audit.list(args.limit ?? 50),
      blockedActions: core.audit.blockedActions(),
      note: 'Local security audit history.',
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Cursor pre-AI hook: security check + optional gate. */
export async function handleNeuronSecurityCheck(
  runtime: NeuronRuntime,
  args: { projectId?: string; text: string; sourceHint?: string; tool?: string },
) {
  try {
    const core = await loadCore(runtime);
    const check = core.checkContext(args.text, args.sourceHint ?? 'file');
    const gate = args.tool
      ? core.gateMcp(args.tool, {}, true)
      : undefined;
    const reportPath = await core.writeReport(neuronDir(runtime));
    await core.save(neuronDir(runtime));
    return okResult({
      check,
      gate: gate ?? null,
      reportPath,
      message: check.message,
    });
  } catch (e) {
    return failResult(e);
  }
}

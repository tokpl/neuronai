export {
  resolvePreparationMode,
  PREPARATION_TOKEN_BUDGETS,
  type PreparationMode,
  type PreparationModeResolved,
} from './modes.js';
export {
  buildCompressionMetrics,
  explainCompressionMetric,
  type CompressionMetrics,
  type CompressionMetricKind,
  type ExclusionRecord,
  type InclusionRecord,
} from './metrics.js';
export { clipLine, estimateTokens, normalizeKey } from './tokens.js';

import {
  resolvePreparationMode,
  type PreparationMode,
  type PreparationModeResolved,
} from './modes.js';
import {
  buildCompressionMetrics,
  explainCompressionMetric,
  type CompressionMetrics,
  type ExclusionRecord,
  type InclusionRecord,
} from './metrics.js';
import { clipLine, estimateTokens, normalizeKey } from './tokens.js';

export interface CompilerCandidate {
  id: string;
  kind: 'decision' | 'warning' | 'architecture' | 'pattern' | 'context';
  title: string;
  content: string;
  /** Internal ranking score — never emitted to the LLM prompt */
  score: number;
}

export interface BrainCompileInput {
  task: string;
  /** MCP mode string or preparation mode */
  mode?: string;
  modules?: string[];
  architectureNotes?: string[];
  decisions?: CompilerCandidate[];
  patterns?: CompilerCandidate[];
  warnings?: string[];
  hints?: string[];
  planSteps?: string[];
  risks?: string[];
  /** Force debug dump even if mode is not debug */
  debug?: boolean;
}

export interface CompiledBrainPrompt {
  /** Single dense prompt for the LLM (markdown). No JSON twin. */
  prompt: string;
  mode: PreparationMode;
  profile: PreparationModeResolved;
  metrics: CompressionMetrics;
  inclusions: InclusionRecord[];
  exclusions: ExclusionRecord[];
  /** Developer-only — omitted unless debug */
  debug?: {
    rawDump: string;
    candidates: CompilerCandidate[];
  };
}

/**
 * Brain Compression Engine — compiles Project Brain retrieval into a minimal prompt.
 * Internal Brain ≠ Prompt.
 */
export class BrainCompiler {
  compile(input: BrainCompileInput): CompiledBrainPrompt {
    const started = Date.now();
    const profile = resolvePreparationMode(input.mode);
    if (input.debug) profile.debug = true;

    const decisions = dedupeCandidates(input.decisions ?? []);
    const patterns = dedupeCandidates(input.patterns ?? []);
    const architecture = uniqueStrings(input.architectureNotes ?? []);
    const modules = uniqueStrings(input.modules ?? []);
    const warnings = uniqueStrings(input.warnings ?? []);
    const hints = uniqueStrings(input.hints ?? []);
    const planSteps = uniqueStrings(input.planSteps ?? []);
    const risks = uniqueStrings(input.risks ?? []);

    const searched =
      decisions.length +
      patterns.length +
      architecture.length +
      warnings.length +
      hints.length +
      planSteps.length +
      risks.length +
      modules.length;

    const inclusions: InclusionRecord[] = [];
    const exclusions: ExclusionRecord[] = [];

    const decisionBullets: string[] = [];
    for (const d of decisions.sort((a, b) => b.score - a.score)) {
      const line = compressDecision(d);
      const next = trialPrompt(input.task, profile.mode, {
        modules,
        architecture,
        decisions: [...decisionBullets, line],
        warnings,
        hints: profile.includeHints ? hints : [],
        planSteps: profile.includePlan ? planSteps : [],
        risks: profile.includeRisks ? risks : [],
      });
      if (estimateTokens(next) <= profile.tokenBudget || decisionBullets.length === 0) {
        decisionBullets.push(line);
        inclusions.push({
          id: d.id,
          title: d.title,
          reason: `High-signal ${d.kind}; fits token budget (${profile.tokenBudget}).`,
        });
      } else {
        exclusions.push({
          id: d.id,
          title: d.title,
          reason: `Dropped to respect ${profile.mode} token budget (${profile.tokenBudget}).`,
        });
      }
    }

    const patternBullets: string[] = [];
    if (profile.mode !== 'minimal') {
      for (const p of patterns.sort((a, b) => b.score - a.score).slice(0, 4)) {
        const line = `• ${clipLine(p.title, 80)}`;
        const next = trialPrompt(input.task, profile.mode, {
          modules,
          architecture,
          decisions: decisionBullets,
          warnings,
          hints: [...hints, ...patternBullets, line],
          planSteps: profile.includePlan ? planSteps : [],
          risks: profile.includeRisks ? risks : [],
        });
        if (estimateTokens(next) <= profile.tokenBudget) {
          patternBullets.push(line);
          inclusions.push({
            id: p.id,
            title: p.title,
            reason: 'Pattern/hint retained under standard/deep budget.',
          });
        } else {
          exclusions.push({
            id: p.id,
            title: p.title,
            reason: 'Pattern omitted — would exceed token budget.',
          });
        }
      }
    } else {
      for (const p of patterns) {
        exclusions.push({
          id: p.id,
          title: p.title,
          reason: 'Minimal mode excludes pattern hints unless they are decisions/warnings.',
        });
      }
    }

    // Trim modules / architecture / warnings to budget
    let mod = modules.slice(0, profile.mode === 'minimal' ? 4 : 8);
    let arch = architecture.slice(0, profile.mode === 'minimal' ? 3 : 6);
    let warn = warnings.slice(0, profile.mode === 'minimal' ? 3 : 6);
    let hintLines = profile.includeHints ? [...hints.slice(0, 4), ...patternBullets] : [];
    let plan = profile.includePlan ? planSteps.slice(0, 6) : [];
    let riskLines = profile.includeRisks ? risks.slice(0, 4) : [];

    let prompt = trialPrompt(input.task, profile.mode, {
      modules: mod,
      architecture: arch,
      decisions: decisionBullets,
      warnings: warn,
      hints: hintLines,
      planSteps: plan,
      risks: riskLines,
    });

    // Pack down until under budget (drop lowest-value sections first)
    while (estimateTokens(prompt) > profile.tokenBudget) {
      if (riskLines.length) {
        riskLines = riskLines.slice(0, -1);
      } else if (plan.length) {
        plan = plan.slice(0, -1);
      } else if (hintLines.length) {
        hintLines = hintLines.slice(0, -1);
      } else if (arch.length > 1) {
        arch = arch.slice(0, -1);
      } else if (mod.length > 1) {
        mod = mod.slice(0, -1);
      } else if (decisionBullets.length > 1) {
        const dropped = decisionBullets.pop();
        if (dropped) {
          exclusions.push({
            id: `decision:${dropped}`,
            title: dropped,
            reason: 'Removed during final budget packing.',
          });
        }
      } else if (warn.length) {
        warn = warn.slice(0, -1);
      } else {
        break;
      }
      prompt = trialPrompt(input.task, profile.mode, {
        modules: mod,
        architecture: arch,
        decisions: decisionBullets,
        warnings: warn,
        hints: hintLines,
        planSteps: plan,
        risks: riskLines,
      });
    }

    const rawDump = buildRawDump(input, decisions, patterns);
    const selected =
      decisionBullets.length +
      warn.length +
      mod.length +
      arch.length +
      hintLines.length +
      plan.length +
      riskLines.length;

    const metrics = buildCompressionMetrics({
      mode: profile.mode,
      tokenBudget: profile.tokenBudget,
      searched,
      selected,
      discarded: Math.max(0, searched - selected),
      promptTokens: estimateTokens(prompt),
      rawDumpTokens: estimateTokens(rawDump),
      preparationTimeMs: Date.now() - started,
    });

    const result: CompiledBrainPrompt = {
      prompt,
      mode: profile.mode,
      profile,
      metrics,
      inclusions,
      exclusions,
    };

    if (profile.debug) {
      result.debug = {
        rawDump,
        candidates: [...decisions, ...patterns],
      };
    }

    return result;
  }

  explainInclusion(compiled: CompiledBrainPrompt, titleOrId: string): string {
    const hit =
      compiled.inclusions.find(
        (i) => i.id === titleOrId || i.title.toLowerCase().includes(titleOrId.toLowerCase()),
      ) ??
      compiled.exclusions.find(
        (i) => i.id === titleOrId || i.title.toLowerCase().includes(titleOrId.toLowerCase()),
      );
    if (!hit) {
      return `No inclusion/exclusion record for "${titleOrId}".`;
    }
    const kept = compiled.inclusions.includes(hit as InclusionRecord);
    return [
      kept ? 'Included in prompt' : 'Excluded from prompt',
      `Title: ${hit.title}`,
      `Reason: ${hit.reason}`,
      `Mode: ${compiled.mode} · prompt ~${compiled.metrics.promptTokens} tokens (budget ${compiled.metrics.tokenBudget})`,
    ].join('\n');
  }

  explainMetric(compiled: CompiledBrainPrompt, key: string): string {
    return explainCompressionMetric(compiled.metrics, key);
  }
}

export function createBrainCompiler(): BrainCompiler {
  return new BrainCompiler();
}

function trialPrompt(
  task: string,
  mode: PreparationMode,
  parts: {
    modules: string[];
    architecture: string[];
    decisions: string[];
    warnings: string[];
    hints: string[];
    planSteps: string[];
    risks: string[];
  },
): string {
  const lines: string[] = [
    `# Task`,
    task.trim(),
    '',
  ];

  if (parts.modules.length) {
    lines.push(`# Relevant modules`);
    for (const m of parts.modules) lines.push(`- ${clipLine(m, 60)}`);
    lines.push('');
  }

  if (parts.architecture.length) {
    lines.push(`# Relevant architecture`);
    for (const a of parts.architecture) lines.push(`- ${clipLine(a, 120)}`);
    lines.push('');
  }

  if (parts.decisions.length) {
    lines.push(`# Architecture decisions`);
    for (const d of parts.decisions) lines.push(d);
    lines.push('');
  }

  if (parts.warnings.length) {
    lines.push(`# Warnings`);
    for (const w of parts.warnings) lines.push(`- ${clipLine(w, 100)}`);
    lines.push('');
  }

  if (mode !== 'minimal' && parts.hints.length) {
    lines.push(`# Implementation hints`);
    for (const h of parts.hints) lines.push(h.startsWith('•') ? h : `- ${clipLine(h, 100)}`);
    lines.push('');
  }

  if (mode === 'deep' && parts.planSteps.length) {
    lines.push(`# Approach`);
    parts.planSteps.forEach((s, i) => lines.push(`${i + 1}. ${clipLine(s, 120)}`));
    lines.push('');
  }

  if (mode === 'deep' && parts.risks.length) {
    lines.push(`# Risks`);
    for (const r of parts.risks) lines.push(`- ${clipLine(r, 100)}`);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function compressDecision(d: CompilerCandidate): string {
  // Prefer first sentence / first line of content; fall back to title
  const body = d.content
    .split(/\n+/)
    .map((l) => scrubInternalNoise(l.replace(/^Decision:\s*/i, '').trim()))
    .filter(Boolean);
  const essence =
    body.find((l) => l.length > 20 && !/^Problem:|^Reason:|^Modules:|^Impact:/i.test(l)) ??
    body[0] ??
    scrubInternalNoise(d.title);
  return `• ${clipLine(essence, 140)}`;
}

/** Strip ranking / storage field names that must never reach the LLM prompt. */
function scrubInternalNoise(text: string): string {
  return text
    .replace(
      /\b(graphDistance|rankingScore|freshness|taskRelevance|importanceScore|confidence|components|rawDump)\b/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function dedupeCandidates(items: CompilerCandidate[]): CompilerCandidate[] {
  const seen = new Set<string>();
  const out: CompilerCandidate[] = [];
  for (const item of items) {
    const key = normalizeKey(item.title, item.content);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function buildRawDump(
  input: BrainCompileInput,
  decisions: CompilerCandidate[],
  patterns: CompilerCandidate[],
): string {
  return JSON.stringify(
    {
      task: input.task,
      modules: input.modules,
      architectureNotes: input.architectureNotes,
      decisions: decisions.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        score: d.score,
      })),
      patterns: patterns.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        score: p.score,
      })),
      warnings: input.warnings,
      hints: input.hints,
      planSteps: input.planSteps,
      risks: input.risks,
    },
    null,
    2,
  );
}

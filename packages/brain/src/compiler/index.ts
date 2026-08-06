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
} from './metrics.js';
export { clipLine, estimateTokens, normalizeKey } from './tokens.js';

import { dedupeRecords } from '../dedupe.js';
import type { RetrievalHit, RetrievalStats } from '../retrieval/rank.js';
import { buildCompressionMetrics, type CompressionMetrics } from './metrics.js';
import {
  resolvePreparationMode,
  type PreparationMode,
  type PreparationModeResolved,
} from './modes.js';
import { clipLine, estimateTokens } from './tokens.js';

export interface CompileRecommendation {
  path: string;
  name: string;
  reason: string;
  related?: Array<{ path: string; name: string }>;
}

export interface BrainCompileInput {
  task: string;
  /** MCP mode string or preparation mode. Defaults to minimal. */
  mode?: string;
  /** Ranked, relevance-gated memories from the retrieval engine. */
  hits: RetrievalHit[];
  /** Modules / files the task touches. */
  modules?: string[];
  /** Best place to start editing, when the question is modification-oriented. */
  recommendation?: CompileRecommendation;
  /** Retrieval telemetry, folded into the compiled metrics. */
  retrieval?: Pick<RetrievalStats, 'candidates' | 'matched' | 'durationMs'>;
  /**
   * Estimated tokens of the entire corpus — the "paste everything" baseline the
   * compression ratio is measured against. Falls back to the matched hits.
   */
  corpusTokens?: number;
}

/** Where the agent-facing text came from. Never included in the prompt itself. */
export interface CompiledSource {
  title: string;
  why: string;
}

export interface CompiledContext {
  /** The single canonical representation handed to the agent. */
  context: string;
  mode: PreparationMode;
  metrics: CompressionMetrics;
  sources: CompiledSource[];
}

type SectionId = 'locations' | 'warnings' | 'decisions' | 'constraints' | 'patterns' | 'context';

interface SectionSpec {
  id: SectionId;
  heading: string;
  /** Lower drops last when the budget is tight. */
  priority: number;
  clip: number;
}

/**
 * Display order is reading order; `priority` decides what survives a tight budget.
 * Locations come first: telling the agent *where to look* is the cheapest, highest
 * leverage thing the brain can say.
 */
const SECTIONS: SectionSpec[] = [
  { id: 'locations', heading: 'Where to look', priority: 1, clip: 120 },
  { id: 'decisions', heading: 'Decisions', priority: 2, clip: 220 },
  { id: 'constraints', heading: 'Constraints', priority: 3, clip: 180 },
  { id: 'warnings', heading: 'Warnings', priority: 0, clip: 180 },
  { id: 'patterns', heading: 'Patterns', priority: 4, clip: 160 },
  { id: 'context', heading: 'Project knowledge', priority: 5, clip: 160 },
];

const SECTION_FOR_KIND: Record<string, SectionId> = {
  location: 'locations',
  decision: 'decisions',
  warning: 'warnings',
  rule: 'constraints',
  pattern: 'patterns',
  knowledge: 'context',
  insight: 'context',
  context: 'context',
};

/**
 * Every mode can emit every section. A relevant pattern must never be dropped
 * just because the mode is minimal — the item cap and token budget do the
 * limiting, and `priority` decides what survives when they bite.
 */
const MODE_MAX_ITEMS: Record<PreparationMode, number> = {
  minimal: 6,
  standard: 12,
  deep: 24,
};

interface Line {
  section: SectionId;
  priority: number;
  score: number;
  text: string;
  title: string;
  why: string;
}

/**
 * Brain Compression Engine.
 *
 * Produces exactly one representation of the project context. Ranking scores,
 * memory ids and internal metadata never reach the compiled text.
 */
export class BrainCompiler {
  compile(input: BrainCompileInput): CompiledContext {
    const started = Date.now();
    const profile = resolvePreparationMode(input.mode);

    // A memory may only ever appear once in the compiled context. Kind is
    // deliberately ignored here: the same knowledge filed as both a decision and
    // a note is still one thing to tell the agent.
    const deduped = dedupeRecords(
      input.hits.map((hit) => ({
        id: hit.doc.id,
        type: 'context',
        title: hit.doc.title,
        content: hit.doc.content,
        tags: hit.doc.tags,
      })),
    );
    const survivingIds = new Set(deduped.records.map((r) => r.id));
    const hits = input.hits.filter((hit) => survivingIds.has(hit.doc.id));

    const lines: Line[] = [];
    const seen = new Set<string>();

    for (const hit of hits) {
      const sectionId = SECTION_FOR_KIND[hit.doc.kind] ?? 'context';
      const spec = SECTIONS.find((s) => s.id === sectionId);
      if (!spec) continue;

      const text = compressEntry(hit, spec.clip);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);

      lines.push({
        section: sectionId,
        priority: spec.priority,
        score: hit.score,
        text,
        title: hit.doc.title,
        why: hit.why,
      });
    }

    lines.sort((a, b) => a.priority - b.priority || b.score - a.score);

    const modules = uniqueStrings(input.modules ?? []).slice(
      0,
      profile.mode === 'minimal' ? 5 : 10,
    );

    // Greedy packing: add the most valuable line while the whole document fits.
    const maxItems = MODE_MAX_ITEMS[profile.mode];
    const chosen: Line[] = [];
    for (const line of lines) {
      if (chosen.length >= maxItems) break;
      const candidate = [...chosen, line];
      if (
        estimateTokens(render(input.task, candidate, modules, input.recommendation)) <=
        profile.tokenBudget
      ) {
        chosen.push(line);
      }
    }

    let context = render(input.task, chosen, modules, input.recommendation);
    // Modules are the cheapest thing to drop if the header alone overflows.
    if (estimateTokens(context) > profile.tokenBudget && modules.length) {
      context = render(input.task, chosen, [], input.recommendation);
    }
    // Recommendation is high-leverage; drop related paths before dropping it entirely.
    if (estimateTokens(context) > profile.tokenBudget && input.recommendation?.related?.length) {
      context = render(input.task, chosen, [], {
        ...input.recommendation,
        related: [],
      });
    }

    const rawCorpusTokens =
      input.corpusTokens ??
      input.hits.reduce(
        (sum, hit) => sum + estimateTokens(`${hit.doc.title}\n${hit.doc.content}`),
        0,
      );

    const metrics = buildCompressionMetrics({
      mode: profile.mode,
      tokenBudget: profile.tokenBudget,
      candidates: input.retrieval?.candidates ?? input.hits.length,
      relevant: input.retrieval?.matched ?? input.hits.length,
      selected: chosen.length,
      duplicatesRemoved: deduped.removed,
      compiledTokens: estimateTokens(context),
      rawCorpusTokens,
      retrievalMs: input.retrieval?.durationMs ?? 0,
      compileMs: Date.now() - started,
    });

    return {
      context,
      mode: profile.mode,
      metrics,
      sources: chosen.map((line) => ({ title: line.title, why: line.why })),
    };
  }
}

export function createBrainCompiler(): BrainCompiler {
  return new BrainCompiler();
}

/** Resolve the preparation profile without compiling (used by adapters). */
export function preparationProfile(mode?: string): PreparationModeResolved {
  return resolvePreparationMode(mode);
}

function render(
  task: string,
  lines: Line[],
  modules: string[],
  recommendation?: CompileRecommendation,
): string {
  const out: string[] = [`# Task`, task.trim()];

  if (recommendation) {
    out.push(
      '',
      '## Recommended start',
      `- ${clipLine(`${recommendation.name} → ${recommendation.path}`, 120)}`,
      `- Because: ${clipLine(recommendation.reason, 160)}`,
    );
    for (const rel of recommendation.related ?? []) {
      out.push(`- Related: ${clipLine(`${rel.name} → ${rel.path}`, 100)}`);
    }
  }

  if (modules.length) {
    out.push('', '## Modules', ...modules.map((m) => `- ${clipLine(m, 80)}`));
  }

  for (const spec of SECTIONS) {
    const section = lines.filter((l) => l.section === spec.id);
    if (!section.length) continue;
    out.push('', `## ${spec.heading}`, ...section.map((l) => `- ${l.text}`));
  }

  if (lines.length === 0 && !recommendation) {
    out.push('', 'No stored project knowledge matched this task.');
  }

  return `${out.join('\n').trim()}\n`;
}

/**
 * Turn a memory into one dense line.
 * Structural prefixes ("Problem:", "Decision:") are dropped so the essence leads.
 */
function compressEntry(hit: RetrievalHit, clip: number): string {
  // A location is a pointer, not prose: "name → path — purpose".
  const entry = hit.doc.location;
  if (entry) {
    const label = entry.kind === 'route' ? entry.name : entry.name;
    const purpose = entry.purpose ? ` — ${entry.purpose}` : '';
    return clipLine(`${label} → ${entry.path}${purpose}`, clip);
  }

  const title = hit.doc.title.replace(/\s+/g, ' ').trim();
  const body = hit.doc.content
    .split(/\n+/)
    .map((line) => scrubInternalNoise(line.trim()))
    .filter(Boolean);

  const essence = body.find(
    (line) => line.length > 24 && !/^(problem|reason|impact|modules|source)\s*:/i.test(line),
  );

  if (!essence) return clipLine(title, clip);

  const detail = essence.replace(/^(decision|rule|warning|pattern)\s*:\s*/i, '');
  if (detail.toLowerCase().startsWith(title.toLowerCase())) return clipLine(detail, clip);
  return clipLine(`${title} — ${detail}`, clip);
}

/** Ranking and storage vocabulary must never leak into the compiled context. */
function scrubInternalNoise(text: string): string {
  return text
    .replace(
      /\b(graphDistance|rankingScore|taskRelevance|importanceScore|freshnessScore|confidenceScore|components|rawDump|score)\b/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
